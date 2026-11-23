/**
 * MCP OAuth endpoint discovery — pure core with injectable dependencies (no Redis, no network).
 * The real wiring (Redis, safeUndiciFetch) lives in mcp-oauth-discovery.service.ts.
 *
 * Flow for a profile with `oauth_config.discovery.enabled === true`:
 *   1. RFC 9728: GET {resource origin}/.well-known/oauth-protected-resource{resource path}
 *      → `resource` must equal the configured resource; take the first `authorization_servers`
 *        entry that is https and inside the host allow-list.
 *   2. RFC 8414: GET {issuer origin}/.well-known/oauth-authorization-server{issuer path}
 *      → `issuer` must equal that server exactly; authorization/token(/revocation) endpoints must be
 *        https and inside the allow-list; S256 and token_endpoint_auth_method `none` are required.
 *
 * Only the three endpoints are discovered. client_id, scope and resource always come from
 * oauth_config, and there is no dynamic client registration.
 *
 * Never throws towards the caller and never blocks an operation: when discovery fails or is rejected
 * it falls back to the last good discovered value (30 days) and then to the static oauth_config
 * endpoints. A failure is cached for 5 minutes (honoured also by forced re-discovery) so the provider
 * is not hit on every call; rejections are alerted once per reason every 24 h. When the
 * discovered endpoints differ from oauth_config, an `ALERT endpoint drift` line is logged once per
 * distinct change (24 h); the DB is NOT rewritten (that stays a reviewed migration).
 *
 * Logs carry only public metadata URLs: never tokens, codes, state or verifiers.
 */

import crypto from 'crypto';
import net from 'net';
import type { MCPOAuthConfig, MCPProviderProfile } from './mcp-providers.service';

// ── Constants ────────────────────────────────────────────────────────────────

export const DISCOVERY_KEY_PREFIX = 'mcp:oauth:discovery:';
export const FRESH_TTL_SECONDS = 6 * 60 * 60;
export const LAST_GOOD_TTL_SECONDS = 30 * 24 * 60 * 60;
export const NEGATIVE_TTL_SECONDS = 5 * 60;
export const DRIFT_TTL_SECONDS = 24 * 60 * 60;
export const REJECTED_ALERT_TTL_SECONDS = 24 * 60 * 60;
/** A forced discovery younger than this is reused by the next forced call (no new request). */
export const FORCED_REUSE_TTL_SECONDS = 5 * 60;
export const DISCOVERY_TIMEOUT_MS = 5_000;
export const DISCOVERY_MAX_BYTES = 64 * 1024;
const MAX_URL_LENGTH = 2048;

// ── Types ────────────────────────────────────────────────────────────────────

export interface OAuthEndpointSet {
  authorizationEndpoint: string;
  tokenEndpoint: string;
  revocationEndpoint?: string;
}

export type EndpointSource = 'discovered' | 'cached' | 'static';

export interface ResolvedOAuthEndpoints extends OAuthEndpointSet {
  source: EndpointSource;
}

export interface ResolveOptions {
  /**
   * Ignores the fresh cache (used to re-check after a rejected refresh). Still bounded: after a failure
   * less than 5 minutes ago no request is made (fallback returned), and a forced discovery less than
   * 5 minutes old is reused as `discovered` instead of being repeated.
   */
  forceRefresh?: boolean;
}

export interface DiscoveryDeps {
  /**
   * GET a metadata document: no redirects, no credentials, bounded time and size. Resolves with the
   * parsed JSON object; throws on any failure (network, timeout, non-200, too large, not a JSON object).
   */
  fetchJson(url: string): Promise<Record<string, unknown>>;
  kv: {
    get(key: string): Promise<string | null>;
    setEx(key: string, value: string, seconds: number): Promise<void>;
    /** SET key value NX EX seconds. True when the key was created. */
    setNx(key: string, value: string, seconds: number): Promise<boolean>;
  };
  log: { info(msg: string): void; warn(msg: string): void; error(msg: string): void };
}

/** The provider answered, but what it answered does not pass validation (never used). */
export class DiscoveryRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiscoveryRejectedError';
  }
}

// ── Host allow-list ──────────────────────────────────────────────────────────

const LABEL = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?';
const SUFFIX_PATTERN = new RegExp(`^${LABEL}(?:\\.${LABEL})+$`);

/**
 * A valid allow-list entry: a lowercase domain name with at least two labels, no wildcards, no
 * trailing dot, and a non-numeric last label (so an entry can never match IP addresses).
 */
export function isValidHostSuffix(suffix: unknown): suffix is string {
  if (typeof suffix !== 'string' || suffix.length > 253 || !SUFFIX_PATTERN.test(suffix)) return false;
  const last = suffix.slice(suffix.lastIndexOf('.') + 1);
  return !/^\d+$/.test(last);
}

/** host === suffix, or host ends with "." + suffix. IP literals never match. */
export function hostAllowed(host: string, suffixes: readonly string[]): boolean {
  if (!host || net.isIP(host) || host.startsWith('[')) return false;
  return suffixes.some((s) => host === s || host.endsWith(`.${s}`));
}

/**
 * Validates a URL taken from metadata (or the configured resource) and returns its normalized href.
 * https only, no credentials, default port only, no fragment, host inside the allow-list, no
 * whitespace/control characters (WHATWG parsing would silently strip them). Query only when allowed.
 */
export function checkDiscoveredUrl(
  field: string,
  raw: unknown,
  suffixes: readonly string[],
  opts: { allowQuery: boolean }
): URL {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_URL_LENGTH) {
    throw new DiscoveryRejectedError(`${field} missing or invalid`);
  }
  // eslint-disable-next-line no-control-regex -- rejecting control characters is the point
  if (/[\u0000- \u007f]/.test(raw)) throw new DiscoveryRejectedError(`${field} contains whitespace or control characters`);
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new DiscoveryRejectedError(`${field} is not a valid URL`);
  }
  if (url.protocol !== 'https:') throw new DiscoveryRejectedError(`${field} is not https`);
  if (url.username || url.password) throw new DiscoveryRejectedError(`${field} has credentials`);
  if (url.port !== '') throw new DiscoveryRejectedError(`${field} uses a non-default port`);
  if (url.hash || raw.includes('#')) throw new DiscoveryRejectedError(`${field} has a fragment`);
  if (!opts.allowQuery && (url.search || raw.includes('?'))) throw new DiscoveryRejectedError(`${field} has a query`);
  if (!hostAllowed(url.hostname, suffixes)) throw new DiscoveryRejectedError(`host not allowed: ${url.hostname} (${field})`);
  return url;
}

// ── Well-known URLs ──────────────────────────────────────────────────────────

function wellKnownUrl(base: URL, name: string): string {
  // RFC 8414 §3.1 / RFC 9728 §3.1: insert the well-known segment between host and path; a
  // terminating "/" of the path is removed first (so a bare origin gets no path at all).
  const path = base.pathname.replace(/\/+$/, '');
  return `${base.origin}/.well-known/${name}${path}`;
}

export function protectedResourceMetadataUrl(resource: URL): string {
  return wellKnownUrl(resource, 'oauth-protected-resource');
}

export function authorizationServerMetadataUrl(issuer: URL): string {
  return wellKnownUrl(issuer, 'oauth-authorization-server');
}

// ── Discovery ────────────────────────────────────────────────────────────────

function includesString(list: unknown, value: string): boolean {
  return Array.isArray(list) && list.some((v) => v === value);
}

/** Runs both metadata requests and validates everything. Throws DiscoveryRejectedError or a fetch error. */
export async function discoverEndpoints(
  deps: Pick<DiscoveryDeps, 'fetchJson'>,
  resource: string,
  suffixes: readonly string[]
): Promise<OAuthEndpointSet> {
  const resourceUrl = checkDiscoveredUrl('configured resource', resource, suffixes, { allowQuery: false });

  const prm = await deps.fetchJson(protectedResourceMetadataUrl(resourceUrl));
  if (prm['resource'] !== resource) throw new DiscoveryRejectedError('resource mismatch');
  const servers = prm['authorization_servers'];
  if (!Array.isArray(servers) || servers.length === 0) throw new DiscoveryRejectedError('authorization_servers missing');

  let issuer: string | null = null;
  let issuerUrl: URL | null = null;
  let lastReason = 'no string entries';
  for (const candidate of servers) {
    if (typeof candidate !== 'string') continue;
    try {
      issuerUrl = checkDiscoveredUrl('authorization server', candidate, suffixes, { allowQuery: false });
      issuer = candidate;
      break;
    } catch (err) {
      lastReason = (err as Error).message;
    }
  }
  if (!issuer || !issuerUrl) throw new DiscoveryRejectedError(`no allowed authorization server (${lastReason})`);

  const asm = await deps.fetchJson(authorizationServerMetadataUrl(issuerUrl));
  if (asm['issuer'] !== issuer) throw new DiscoveryRejectedError('issuer mismatch');

  const authorization = checkDiscoveredUrl('authorization_endpoint', asm['authorization_endpoint'], suffixes, { allowQuery: true });
  const token = checkDiscoveredUrl('token_endpoint', asm['token_endpoint'], suffixes, { allowQuery: true });
  const revocationRaw = asm['revocation_endpoint'];
  const revocation =
    revocationRaw == null ? undefined : checkDiscoveredUrl('revocation_endpoint', revocationRaw, suffixes, { allowQuery: true });

  if (!includesString(asm['code_challenge_methods_supported'], 'S256')) {
    throw new DiscoveryRejectedError('code_challenge_methods_supported lacks S256');
  }
  if (!includesString(asm['token_endpoint_auth_methods_supported'], 'none')) {
    throw new DiscoveryRejectedError('token_endpoint_auth_methods_supported lacks none (public client)');
  }

  return {
    authorizationEndpoint: authorization.href,
    tokenEndpoint: token.href,
    ...(revocation ? { revocationEndpoint: revocation.href } : {}),
  };
}

// ── Resolution with cache and fallback ───────────────────────────────────────

export function staticEndpoints(cfg: MCPOAuthConfig): OAuthEndpointSet {
  return {
    authorizationEndpoint: cfg.authorization_endpoint,
    tokenEndpoint: cfg.token_endpoint,
    ...(cfg.revocation_endpoint ? { revocationEndpoint: cfg.revocation_endpoint } : {}),
  };
}

function sha(text: string, len: number): string {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, len);
}

/** `new URL(x).href`, or the raw string when it does not parse (static values are compared, not trusted). */
function normalizeUrl(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  try {
    return new URL(raw).href;
  } catch {
    return raw;
  }
}

/**
 * Cache keys are bound to the config they were discovered under: resource, allow-list AND the three
 * static endpoints. A migration that changes any static endpoint therefore invalidates the fresh and
 * last-good entries (they can no longer outrank a reviewed fix).
 */
export function discoveryCacheKeys(
  profileId: string,
  resource: string,
  suffixes: readonly string[],
  stat: OAuthEndpointSet
) {
  const fp = sha(
    JSON.stringify({
      resource,
      suffixes: [...suffixes].sort(),
      authorization: stat.authorizationEndpoint,
      token: stat.tokenEndpoint,
      revocation: stat.revocationEndpoint ?? null,
    }),
    16
  );
  const base = `${DISCOVERY_KEY_PREFIX}${profileId}:${fp}:`;
  return { fresh: `${base}fresh`, lastGood: `${base}last-good`, negative: `${base}negative`, forced: `${base}forced` };
}

/** Cached values are re-validated against the CURRENT allow-list before use. */
function readCached(raw: string | null, suffixes: readonly string[]): OAuthEndpointSet | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    const authorization = checkDiscoveredUrl('authorization_endpoint', v['authorizationEndpoint'], suffixes, { allowQuery: true });
    const token = checkDiscoveredUrl('token_endpoint', v['tokenEndpoint'], suffixes, { allowQuery: true });
    const revocation =
      v['revocationEndpoint'] == null
        ? undefined
        : checkDiscoveredUrl('revocation_endpoint', v['revocationEndpoint'], suffixes, { allowQuery: true });
    return {
      authorizationEndpoint: authorization.href,
      tokenEndpoint: token.href,
      ...(revocation ? { revocationEndpoint: revocation.href } : {}),
    };
  } catch {
    return null;
  }
}

/**
 * The revocation endpoint is optional in RFC 8414 metadata: when the discovered (or cached) set has
 * none, the static one from oauth_config (reviewed, in the DB) is used, so revocation never gets
 * silently skipped. Authorization/token always come from the same discovered set.
 */
function withStaticRevocation(set: OAuthEndpointSet, stat: OAuthEndpointSet): OAuthEndpointSet {
  if (set.revocationEndpoint || !stat.revocationEndpoint) return set;
  return { ...set, revocationEndpoint: stat.revocationEndpoint };
}

async function reportDrift(deps: DiscoveryDeps, profileId: string, stat: OAuthEndpointSet, found: OAuthEndpointSet): Promise<void> {
  // Static values normalized like the discovered ones: ":443" or case alone is not a drift.
  const fields: Array<[string, string | undefined, string | undefined]> = [
    ['authorization_endpoint', normalizeUrl(stat.authorizationEndpoint), found.authorizationEndpoint],
    ['token_endpoint', normalizeUrl(stat.tokenEndpoint), found.tokenEndpoint],
    ['revocation_endpoint', normalizeUrl(stat.revocationEndpoint), found.revocationEndpoint],
  ];
  for (const [field, s, d] of fields) {
    if (s === d) continue;
    const key = `${DISCOVERY_KEY_PREFIX}drift:${profileId}:${sha(`${field}|${s ?? ''}|${d ?? ''}`, 32)}`;
    let first = true;
    try {
      first = await deps.kv.setNx(key, '1', DRIFT_TTL_SECONDS);
    } catch {
      first = true; // without Redis an extra alert is better than a silent drift
    }
    if (first) {
      deps.log.error(
        `[mcp-oauth] ALERT endpoint drift for provider ${profileId}: ${field} static=${s ?? '(none)'} discovered=${d ?? '(none)'}`
      );
    }
  }
}

/** `ALERT discovery rejected` at most once per provider and reason every 24 h (like drift alerts). */
async function alertRejected(deps: DiscoveryDeps, profileId: string, reason: string, outcome: string): Promise<void> {
  const key = `${DISCOVERY_KEY_PREFIX}rejected-alert:${profileId}:${sha(reason, 32)}`;
  let first = true;
  try {
    first = await deps.kv.setNx(key, '1', REJECTED_ALERT_TTL_SECONDS);
  } catch {
    first = true; // without Redis an extra alert is better than a silent rejection
  }
  if (first) deps.log.error(`[mcp-oauth] ALERT discovery rejected for provider ${profileId}: ${reason}; ${outcome}`);
}

async function kvGet(deps: DiscoveryDeps, key: string): Promise<string | null> {
  try {
    return await deps.kv.get(key);
  } catch {
    return null;
  }
}

async function kvSetEx(deps: DiscoveryDeps, key: string, value: string, seconds: number): Promise<void> {
  try {
    await deps.kv.setEx(key, value, seconds);
  } catch {
    // cache is an optimisation only
  }
}

/**
 * Endpoints to use for this profile. Never throws for a profile with oauth_config: any failure ends
 * in the last good discovered value or the static oauth_config endpoints.
 */
export async function resolveOAuthEndpointsCore(
  deps: DiscoveryDeps,
  profile: Pick<MCPProviderProfile, 'id' | 'oauth_config' | 'default_server_url'>,
  opts: ResolveOptions = {}
): Promise<ResolvedOAuthEndpoints> {
  const cfg = profile.oauth_config;
  if (!cfg) throw new Error('Provider does not use OAuth');
  const stat: ResolvedOAuthEndpoints = { ...staticEndpoints(cfg), source: 'static' };
  const discovery = cfg.discovery;
  if (!discovery || discovery.enabled !== true) return stat;

  try {
    const suffixes = discovery.allowed_host_suffixes;
    if (!Array.isArray(suffixes) || suffixes.length === 0 || !suffixes.every(isValidHostSuffix)) {
      await alertRejected(deps, profile.id, 'invalid allowed_host_suffixes', 'using static endpoints');
      return stat;
    }
    const resource = cfg.resource ?? profile.default_server_url;
    if (!resource) {
      await alertRejected(deps, profile.id, 'no resource configured', 'using static endpoints');
      return stat;
    }

    const keys = discoveryCacheKeys(profile.id, resource, suffixes, stat);
    const fromCache = (set: OAuthEndpointSet): ResolvedOAuthEndpoints => ({ ...withStaticRevocation(set, stat), source: 'cached' });
    const fallback = async (): Promise<ResolvedOAuthEndpoints> => {
      const good = readCached(await kvGet(deps, keys.lastGood), suffixes);
      return good ? fromCache(good) : stat;
    };

    if (!opts.forceRefresh) {
      const fresh = readCached(await kvGet(deps, keys.fresh), suffixes);
      if (fresh) return fromCache(fresh);
    } else {
      // A forced discovery made < 5 min ago (by any process) IS a fresh discovery: reuse it instead
      // of hitting the provider again on every rejected refresh. Re-validated like any cached value.
      const recent = readCached(await kvGet(deps, keys.forced), suffixes);
      if (recent) return { ...withStaticRevocation(recent, stat), source: 'discovered' };
    }
    // Honoured even when forced: a failure < 5 min ago means no new request (no re-discovery storm).
    if (await kvGet(deps, keys.negative)) return fallback();

    try {
      const found = await discoverEndpoints(deps, resource, suffixes);
      const serialized = JSON.stringify(found);
      await kvSetEx(deps, keys.fresh, serialized, FRESH_TTL_SECONDS);
      await kvSetEx(deps, keys.lastGood, serialized, LAST_GOOD_TTL_SECONDS);
      if (opts.forceRefresh) await kvSetEx(deps, keys.forced, serialized, FORCED_REUSE_TTL_SECONDS);
      await reportDrift(deps, profile.id, stat, found);
      return { ...withStaticRevocation(found, stat), source: 'discovered' };
    } catch (err) {
      if (err instanceof DiscoveryRejectedError) {
        await alertRejected(deps, profile.id, err.message, 'using fallback endpoints');
      } else {
        deps.log.warn(`[mcp-oauth] Discovery failed for provider ${profile.id}: ${(err as Error).message}; using fallback endpoints`);
      }
      await kvSetEx(deps, keys.negative, '1', NEGATIVE_TTL_SECONDS);
      return fallback();
    }
  } catch (err) {
    deps.log.error(`[mcp-oauth] Discovery for provider ${profile.id} failed unexpectedly: ${(err as Error).message}; using static endpoints`);
    return stat;
  }
}
