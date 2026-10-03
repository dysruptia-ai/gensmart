/**
 * Anti-SSRF helpers for every URL that a user (or the model) controls.
 *
 * - isPublicIp: pure address classification (IPv4 and IPv6, including mapped / NAT64 / 6to4).
 * - assertSafeUrl: scheme, credentials, literal IP and DNS resolution checks.
 * - safeLookup: dns.lookup replacement used by the sockets themselves, so the address that is
 *   checked is the address that is connected to (closes the DNS rebinding window).
 * - safeFetch: HTTP client with manual redirects (revalidated on every hop), size and time limits.
 * - createSafeDispatcher / safeUndiciFetch: the undici fetch (streaming bodies) connected through
 *   safeLookup, with redirects refused.
 *
 * No imports from the rest of the app: it only depends on Node built-ins and undici.
 */

import dns from 'dns';
import http from 'http';
import https from 'https';
import net from 'net';
import zlib from 'zlib';
import { Agent, fetch as undiciFetch, type RequestInit as UndiciRequestInit, type Response as UndiciResponse } from 'undici';

export type UnsafeUrlCode =
  | 'INVALID_URL'
  | 'NOT_HTTPS'
  | 'CREDENTIALS_IN_URL'
  | 'BLOCKED_HOST'
  | 'DNS_FAILED'
  | 'TOO_MANY_REDIRECTS'
  | 'RESPONSE_TOO_LARGE';

export class UnsafeUrlError extends Error {
  constructor(public code: UnsafeUrlCode, message?: string) {
    super(message ?? code);
    this.name = 'UnsafeUrlError';
  }
}

// ── Address classification ────────────────────────────────────────────────────

const BLOCKED_V4: ReadonlyArray<[string, number]> = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4], // includes 255.255.255.255
];

const BLOCKED_V6: ReadonlyArray<[string, number]> = [
  ['::', 96], // unspecified, loopback and the deprecated IPv4-compatible range
  ['100::', 64], // discard-only
  ['2001::', 32], // Teredo
  ['2001:db8::', 32], // documentation
  ['64:ff9b:1::', 48], // local-use NAT64
  ['fc00::', 7], // unique local
  ['fe80::', 10], // link-local
  ['ff00::', 8], // multicast
];

const blockList = new net.BlockList();
for (const [addr, prefix] of BLOCKED_V4) blockList.addSubnet(addr, prefix, 'ipv4');
for (const [addr, prefix] of BLOCKED_V6) blockList.addSubnet(addr, prefix, 'ipv6');

/** 16 bytes of an IPv6 address, or null when the text is not a valid IPv6 address. */
function parseIPv6(text: string): Buffer | null {
  if (net.isIP(text) !== 6 || text.includes('%')) return null;
  let head = text;
  let tail = '';
  const dbl = text.indexOf('::');
  if (dbl !== -1) {
    head = text.slice(0, dbl);
    tail = text.slice(dbl + 2);
  }
  const toGroups = (part: string): number[] | null => {
    if (!part) return [];
    const groups: number[] = [];
    const pieces = part.split(':');
    for (let i = 0; i < pieces.length; i++) {
      const piece = pieces[i]!;
      if (piece.includes('.')) {
        // embedded dotted quad (only valid as the last piece)
        if (i !== pieces.length - 1 || net.isIP(piece) !== 4) return null;
        const o = piece.split('.').map(Number);
        groups.push((o[0]! << 8) | o[1]!, (o[2]! << 8) | o[3]!);
      } else {
        if (!/^[0-9a-fA-F]{1,4}$/.test(piece)) return null;
        groups.push(parseInt(piece, 16));
      }
    }
    return groups;
  };
  const headGroups = toGroups(head);
  const tailGroups = toGroups(tail);
  if (!headGroups || !tailGroups) return null;
  const missing = 8 - headGroups.length - tailGroups.length;
  if (dbl === -1 ? missing !== 0 : missing < 1) return null;
  const all = [...headGroups, ...new Array<number>(dbl === -1 ? 0 : missing).fill(0), ...tailGroups];
  const buf = Buffer.alloc(16);
  all.forEach((g, i) => buf.writeUInt16BE(g, i * 2));
  return buf;
}

function v4FromBytes(b: Buffer, offset: number): string {
  return `${b[offset]}.${b[offset + 1]}.${b[offset + 2]}.${b[offset + 3]}`;
}

/** True only for globally routable unicast addresses. Anything that is not an IP is false. */
export function isPublicIp(ip: string): boolean {
  const version = net.isIP(ip);
  if (version === 4) return !blockList.check(ip, 'ipv4');
  if (version !== 6) return false;

  const bytes = parseIPv6(ip);
  if (!bytes) return false;

  const first80Zero = bytes.subarray(0, 10).every((x) => x === 0);
  // ::ffff:0:0/96 — IPv4-mapped: the IPv4 part decides
  if (first80Zero && bytes[10] === 0xff && bytes[11] === 0xff) return isPublicIp(v4FromBytes(bytes, 12));
  // 64:ff9b::/96 — NAT64: the IPv4 part decides
  if (
    bytes.readUInt16BE(0) === 0x0064 && bytes.readUInt16BE(2) === 0xff9b &&
    bytes.subarray(4, 12).every((x) => x === 0)
  ) {
    return isPublicIp(v4FromBytes(bytes, 12));
  }
  // 2002::/16 — 6to4: the embedded IPv4 decides
  if (bytes.readUInt16BE(0) === 0x2002) return isPublicIp(v4FromBytes(bytes, 2));

  return !blockList.check(ip, 'ipv6');
}

// ── Policy ────────────────────────────────────────────────────────────────────

/** Private targets and plain http are only ever allowed outside production, with an explicit flag. */
function allowPrivateTargets(): boolean {
  return process.env['NODE_ENV'] !== 'production' && process.env['SSRF_ALLOW_PRIVATE'] === 'true';
}

function stripBrackets(hostname: string): string {
  return hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
}

/**
 * Validates a URL that comes from a user. Resolves the host and requires EVERY address to be public.
 * The caller must still connect through safeLookup (safeFetch does) to close the rebinding window.
 */
export async function assertSafeUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError('INVALID_URL');
  }

  const permissive = allowPrivateTargets();
  if (url.protocol !== 'https:' && !(permissive && url.protocol === 'http:')) {
    throw new UnsafeUrlError('NOT_HTTPS');
  }
  if (url.username || url.password) {
    throw new UnsafeUrlError('CREDENTIALS_IN_URL');
  }

  const hostname = stripBrackets(url.hostname);
  if (!hostname) throw new UnsafeUrlError('INVALID_URL');
  if (permissive) return url;

  if (net.isIP(hostname)) {
    if (!isPublicIp(hostname)) throw new UnsafeUrlError('BLOCKED_HOST');
    return url;
  }

  let addresses: dns.LookupAddress[];
  try {
    addresses = await dns.promises.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new UnsafeUrlError('DNS_FAILED');
  }
  if (addresses.length === 0) throw new UnsafeUrlError('DNS_FAILED');
  if (!addresses.every((a) => isPublicIp(a.address))) throw new UnsafeUrlError('BLOCKED_HOST');
  return url;
}

/**
 * dns.lookup replacement for sockets: the connection can only go to a public address.
 * Compatible with the `lookup` option of http.request, https.request and net.connect.
 */
export const safeLookup = ((
  hostname: string,
  options: dns.LookupOptions | number | ((...args: never[]) => void),
  callback?: (...args: never[]) => void
): void => {
  const cb = (typeof options === 'function' ? options : callback) as (...args: unknown[]) => void;
  const opts: dns.LookupOptions =
    typeof options === 'function' ? {} : typeof options === 'number' ? { family: options } : options;

  dns.lookup(hostname, { ...opts, all: true }, (err, addresses) => {
    if (err) return cb(err);
    const list = addresses as dns.LookupAddress[];
    if (!allowPrivateTargets() && !list.every((a) => isPublicIp(a.address))) {
      const unsafe = Object.assign(new Error('Address not allowed'), { code: 'EUNSAFE_ADDRESS' });
      return cb(unsafe);
    }
    if (opts.all) return cb(null, list);
    const first = list[0];
    if (!first) return cb(Object.assign(new Error('No address'), { code: 'ENOTFOUND' }));
    return cb(null, first.address, first.family);
  });
}) as unknown as net.LookupFunction;

// ── Redirect helpers (pure) ───────────────────────────────────────────────────

export const REDIRECT_STATUSES: ReadonlySet<number> = new Set([301, 302, 303, 307, 308]);

/** Resolves a Location header against the current URL. Null when it is not a valid URL. */
export function resolveRedirectLocation(current: string | URL, location: string): URL | null {
  try {
    return new URL(location, current);
  } catch {
    return null;
  }
}

/** Method and body handling for a redirect: 303 (and POST on 301/302) become GET; 307/308 keep both. */
export function redirectMethod(status: number, method: string): { method: string; keepBody: boolean } {
  const upper = method.toUpperCase();
  if (status === 303) return { method: upper === 'HEAD' ? 'HEAD' : 'GET', keepBody: false };
  if ((status === 301 || status === 302) && upper === 'POST') return { method: 'GET', keepBody: false };
  return { method: upper, keepBody: true };
}

const CROSS_ORIGIN_SAFE_HEADERS = new Set(['accept', 'accept-language', 'user-agent', 'content-type', 'range']);

/** Credentials and custom headers never follow a redirect to another origin. */
export function headersForRedirect(
  headers: Record<string, string>,
  from: URL,
  to: URL,
  keepBody: boolean
): Record<string, string> {
  const sameOrigin = from.origin === to.origin;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    const lower = k.toLowerCase();
    if (lower === 'content-length') continue;
    if (!keepBody && lower === 'content-type') continue;
    if (!sameOrigin && !CROSS_ORIGIN_SAFE_HEADERS.has(lower)) continue;
    out[k] = v;
  }
  return out;
}

// ── safeFetch ─────────────────────────────────────────────────────────────────

export interface SafeFetchInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  /** Keep the first maxBytes and stop, instead of failing with RESPONSE_TOO_LARGE (e.g. Range probes). */
  truncate?: boolean;
}

export interface SafeResponse {
  status: number;
  ok: boolean;
  statusText: string;
  headers: Headers;
  url: string;
  text(): Promise<string>;
  json(): Promise<unknown>;
  arrayBuffer(): Promise<ArrayBuffer>;
}

interface RawResponse {
  status: number;
  statusText: string;
  headers: Headers;
  body: Buffer;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_MAX_REDIRECTS = 3;

function toHeaders(raw: http.IncomingHttpHeaders): Headers {
  const headers = new Headers();
  for (const [k, v] of Object.entries(raw)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) v.forEach((item) => headers.append(k, item));
    else headers.set(k, v);
  }
  return headers;
}

function decodeBody(body: Buffer, encoding: string, maxBytes: number): Promise<Buffer> {
  const enc = encoding.trim().toLowerCase();
  const options = { maxOutputLength: maxBytes };
  const run = (fn: (b: Buffer, o: zlib.ZlibOptions, cb: (e: Error | null, r: Buffer) => void) => void) =>
    new Promise<Buffer>((resolve, reject) => {
      fn(body, options, (err, result) => {
        if (err) {
          reject((err as { code?: string }).code === 'ERR_BUFFER_TOO_LARGE' ? new UnsafeUrlError('RESPONSE_TOO_LARGE') : err);
        } else {
          resolve(result);
        }
      });
    });
  if (enc === 'gzip' || enc === 'x-gzip') return run(zlib.gunzip);
  if (enc === 'deflate') return run(zlib.inflate);
  if (enc === 'br') return run(zlib.brotliDecompress as never);
  return Promise.resolve(body);
}

function requestOnce(
  url: URL,
  init: { method: string; headers: Record<string, string>; body?: string },
  deadline: number,
  maxBytes: number,
  truncate: boolean
): Promise<RawResponse> {
  return new Promise<RawResponse>((resolve, reject) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      reject(Object.assign(new Error('Request timed out'), { name: 'AbortError' }));
      return;
    }

    const isHttps = url.protocol === 'https:';
    // A truncated read keeps raw bytes (no decompression), so it asks for an uncompressed body
    // unless the caller sets its own Accept-Encoding.
    const callerSetsEncoding = Object.keys(init.headers).some((k) => k.toLowerCase() === 'accept-encoding');
    const headers: Record<string, string> = {
      ...(callerSetsEncoding ? {} : { 'Accept-Encoding': truncate ? 'identity' : 'gzip, deflate, br' }),
      ...init.headers,
    };
    if (init.body !== undefined) headers['Content-Length'] = String(Buffer.byteLength(init.body));

    let settled = false;
    const finish = (fn: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };

    const req = (isHttps ? https : http).request(
      {
        protocol: url.protocol,
        hostname: stripBrackets(url.hostname),
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: init.method,
        headers,
        lookup: safeLookup,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const base = { status, statusText: res.statusMessage ?? '', headers: toHeaders(res.headers) };

        // No body to keep: redirects and HEAD responses
        if (REDIRECT_STATUSES.has(status) || init.method === 'HEAD') {
          res.resume();
          finish(() => resolve({ ...base, body: Buffer.alloc(0) }));
          return;
        }

        const declared = Number(res.headers['content-length']);
        if (!truncate && Number.isFinite(declared) && declared > maxBytes && !res.headers['content-encoding']) {
          req.destroy();
          finish(() => reject(new UnsafeUrlError('RESPONSE_TOO_LARGE')));
          return;
        }

        const chunks: Buffer[] = [];
        let size = 0;
        const complete = (): void => {
          const raw = Buffer.concat(chunks);
          const encoding = String(res.headers['content-encoding'] ?? '');
          const decode = encoding && !truncate ? decodeBody(raw, encoding, maxBytes) : Promise.resolve(raw);
          decode.then(
            (body) => finish(() => resolve({ ...base, body })),
            (err: Error) => finish(() => reject(err))
          );
        };

        res.on('data', (chunk: Buffer) => {
          if (settled) return;
          size += chunk.length;
          if (size > maxBytes) {
            if (truncate) {
              chunks.push(chunk.subarray(0, chunk.length - (size - maxBytes)));
              res.destroy();
              complete();
            } else {
              req.destroy();
              finish(() => reject(new UnsafeUrlError('RESPONSE_TOO_LARGE')));
            }
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', complete);
        res.on('error', (err) => finish(() => reject(err)));
      }
    );

    const timer = setTimeout(() => {
      req.destroy();
      finish(() => reject(Object.assign(new Error('Request timed out'), { name: 'AbortError' })));
    }, remaining);

    req.on('error', (err) => finish(() => reject(err)));
    if (init.body !== undefined) req.write(init.body);
    req.end();
  });
}

function buildResponse(raw: RawResponse, url: string): SafeResponse {
  return {
    status: raw.status,
    ok: raw.status >= 200 && raw.status < 300,
    statusText: raw.statusText,
    headers: raw.headers,
    url,
    text: async () => raw.body.toString('utf8'),
    json: async () => JSON.parse(raw.body.toString('utf8')) as unknown,
    arrayBuffer: async () =>
      raw.body.buffer.slice(raw.body.byteOffset, raw.body.byteOffset + raw.body.byteLength) as ArrayBuffer,
  };
}

/**
 * Fetch for user-controlled URLs. Every hop (the first request and each redirect) goes through
 * assertSafeUrl and connects with safeLookup. The whole call shares a single timeout.
 */
export async function safeFetch(rawUrl: string, init: SafeFetchInit = {}): Promise<SafeResponse> {
  const maxBytes = init.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxRedirects = init.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const deadline = Date.now() + (init.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  let current = await assertSafeUrl(rawUrl);
  let method = (init.method ?? 'GET').toUpperCase();
  let body = init.body;
  let headers = { ...(init.headers ?? {}) };

  for (let hop = 0; ; hop++) {
    const raw = await requestOnce(current, { method, headers, body }, deadline, maxBytes, init.truncate ?? false);

    const location = raw.headers.get('location');
    if (REDIRECT_STATUSES.has(raw.status) && location) {
      if (hop >= maxRedirects) throw new UnsafeUrlError('TOO_MANY_REDIRECTS');
      const next = resolveRedirectLocation(current, location);
      if (!next) throw new UnsafeUrlError('INVALID_URL');
      const validated = await assertSafeUrl(next.href);
      const change = redirectMethod(raw.status, method);
      headers = headersForRedirect(headers, current, validated, change.keepBody);
      method = change.method;
      if (!change.keepBody) body = undefined;
      current = validated;
      continue;
    }

    return buildResponse(raw, current.href);
  }
}

// ── undici fetch (streaming) ──────────────────────────────────────────────────

/**
 * undici Agent whose sockets resolve names through safeLookup: the address that is connected to is the
 * address that was checked, so there is no DNS rebinding window between assertSafeUrl and the connection.
 */
export function createSafeDispatcher(): Agent {
  return new Agent({ connect: { lookup: safeLookup } });
}

let sharedDispatcher: Agent | null = null;

/**
 * fetch (undici) for callers that need to stream the response body. Always connects through safeLookup
 * and refuses redirects (a redirect must not move the request to another destination). It does not
 * validate the URL: call assertSafeUrl first, as safeFetch does. Both undici pieces come from the same
 * package version, so Response, Headers and AbortSignal are compatible.
 */
export function safeUndiciFetch(url: string, init: UndiciRequestInit = {}): Promise<UndiciResponse> {
  sharedDispatcher ??= createSafeDispatcher();
  return undiciFetch(url, { ...init, dispatcher: sharedDispatcher, redirect: 'error' });
}

