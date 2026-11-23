/**
 * MCP OAuth endpoint discovery — real wiring (Redis cache, safeUndiciFetch) around the pure core in
 * mcp-oauth-discovery.core.ts. See that file for the rules.
 *
 * Every metadata request: assertSafeUrl + safeUndiciFetch (SSRF-safe socket lookup, redirects
 * refused), GET, Accept: application/json, no Authorization/cookies, 5 s total timeout (DNS check
 * and body included) and a 64 KB cap on the decoded body. The starting URLs come from the provider profile
 * in the DB (migrations), never from the client.
 */

import { redis } from '../config/redis';
import { assertSafeUrl, safeUndiciFetch, readBodyLimited, BodyTooLargeError, DEFAULT_USER_AGENT } from './safe-url';
import type { MCPProviderProfile } from './mcp-providers.service';
import {
  resolveOAuthEndpointsCore,
  DISCOVERY_MAX_BYTES,
  DISCOVERY_TIMEOUT_MS,
  type DiscoveryDeps,
  type ResolveOptions,
  type ResolvedOAuthEndpoints,
} from './mcp-oauth-discovery.core';

export type { ResolvedOAuthEndpoints, ResolveOptions } from './mcp-oauth-discovery.core';

/** Rejects as soon as `signal` aborts (never resolves otherwise). */
function abortedPromise(signal: AbortSignal): Promise<never> {
  return new Promise<never>((_resolve, reject) => {
    if (signal.aborted) return reject(new Error('aborted'));
    signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  });
}

/** GET a metadata document (see the file header). Throws on any failure. */
export async function fetchMetadataJson(
  url: string,
  opts: {
    timeoutMs?: number;
    maxBytes?: number;
    /** URL check (resolves DNS). Injectable for tests; assertSafeUrl by default. */
    assertUrl?: (url: string) => Promise<unknown>;
  } = {}
): Promise<Record<string, unknown>> {
  const timeoutMs = opts.timeoutMs ?? DISCOVERY_TIMEOUT_MS;
  const maxBytes = opts.maxBytes ?? DISCOVERY_MAX_BYTES;
  const assertUrl = opts.assertUrl ?? assertSafeUrl;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // The DNS lookup inside assertSafeUrl cannot be cancelled: race it against the same deadline so
    // a slow resolver counts inside the 5 s budget instead of extending it.
    await Promise.race([assertUrl(url), abortedPromise(controller.signal)]);
    const res = await safeUndiciFetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json', 'User-Agent': DEFAULT_USER_AGENT },
      credentials: 'omit',
      signal: controller.signal,
    });
    if (res.status !== 200) {
      await res.body?.cancel().catch(() => {});
      throw new Error(`metadata HTTP ${res.status}`);
    }
    const declared = Number(res.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > maxBytes) {
      await res.body?.cancel().catch(() => {});
      throw new Error('metadata response too large');
    }
    let text: string;
    try {
      text = await readBodyLimited(res.body as ReadableStream<Uint8Array> | null, maxBytes);
    } catch (err) {
      if (err instanceof BodyTooLargeError) throw new Error('metadata response too large');
      throw err;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('metadata is not valid JSON');
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('metadata is not a JSON object');
    return parsed as Record<string, unknown>;
  } catch (err) {
    if (controller.signal.aborted) throw new Error('metadata request timed out');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export const realDiscoveryDeps: DiscoveryDeps = {
  fetchJson: (url) => fetchMetadataJson(url),
  kv: {
    get: (key) => redis.get(key),
    setEx: async (key, value, seconds) => {
      await redis.set(key, value, 'EX', seconds);
    },
    setNx: async (key, value, seconds) => (await redis.set(key, value, 'EX', seconds, 'NX')) === 'OK',
  },
  log: {
    info: (m) => console.log(m),
    warn: (m) => console.warn(m),
    error: (m) => console.error(m),
  },
};

/** OAuth endpoints for a profile with oauth_config (discovered, cached or static). Never throws for such a profile. */
export function resolveOAuthEndpoints(
  profile: Pick<MCPProviderProfile, 'id' | 'oauth_config' | 'default_server_url'>,
  opts: ResolveOptions = {}
): Promise<ResolvedOAuthEndpoints> {
  return resolveOAuthEndpointsCore(realDiscoveryDeps, profile, opts);
}
