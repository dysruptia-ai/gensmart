/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers tests at import */
/**
 * OAuth endpoint discovery (RFC 9728 + RFC 8414): validation, cache/fallback, drift alerts, the real
 * metadata fetcher against a local HTTP server, and the wiring into authorize / token / revoke.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import crypto from 'crypto';
import type { AddressInfo } from 'net';
import {
  resolveOAuthEndpointsCore,
  isValidHostSuffix,
  hostAllowed,
  protectedResourceMetadataUrl,
  authorizationServerMetadataUrl,
  discoveryCacheKeys,
  staticEndpoints,
  NEGATIVE_TTL_SECONDS,
  FRESH_TTL_SECONDS,
  LAST_GOOD_TTL_SECONDS,
  DISCOVERY_MAX_BYTES,
  type DiscoveryDeps,
} from './mcp-oauth-discovery.core';
import { fetchMetadataJson } from './mcp-oauth-discovery.service';
import { postForm, TOKEN_RESPONSE_MAX_BYTES } from './mcp-oauth.service';
import { parseOAuthDiscoveryConfig, toPublicProfile, type MCPProviderProfile, type MCPOAuthConfig } from './mcp-providers.service';
import { authorizeConfigFor, tokenEndpointsFor, rediscoverTokenEndpoint, type ProfileEndpointDeps } from './mcp-oauth.service';
import { revokeOAuthSession, type RevokeDeps } from './mcp-oauth-revoke.service';
import { startAuthorizationCore, getValidAccessTokenCore, McpOAuthTransientError, type OAuthDeps, type StoredOAuth } from './mcp-oauth.core';

// ── Fixtures (real Dropi metadata, 2026-11-19) ───────────────────────────────

const PRM_URL = 'https://mcp.dropi.co/.well-known/oauth-protected-resource/mcp';
const ASM_URL = 'https://mcp.dropi.co/.well-known/oauth-authorization-server';

const DROPI_PRM = {
  resource: 'https://mcp.dropi.co/mcp',
  authorization_servers: ['https://mcp.dropi.co'],
  scopes_supported: ['mcp'],
  bearer_methods_supported: ['header'],
};

const DROPI_ASM = {
  issuer: 'https://mcp.dropi.co',
  authorization_endpoint: 'https://mcp.dropi.co/login/authorize',
  token_endpoint: 'https://mcp.dropi.co/oauth/token',
  registration_endpoint: 'https://mcp.dropi.co/oauth/register',
  revocation_endpoint: 'https://mcp.dropi.co/oauth/revoke',
  response_types_supported: ['code'],
  grant_types_supported: ['authorization_code', 'refresh_token'],
  code_challenge_methods_supported: ['S256'],
  token_endpoint_auth_methods_supported: ['none'],
  revocation_endpoint_auth_methods_supported: ['none'],
  scopes_supported: ['mcp'],
};

const OLD_STATIC = {
  authorization_endpoint: 'https://oauth.dropi.co/oauth/authorize',
  token_endpoint: 'https://integrations.dropi.co/oauth/token',
  revocation_endpoint: 'https://integrations.dropi.co/oauth/revoke',
};

function dropiProfile(over: Partial<MCPOAuthConfig> = {}, discovery: MCPOAuthConfig['discovery'] | null = { enabled: true, allowed_host_suffixes: ['dropi.co'] }): MCPProviderProfile {
  const oauth_config: MCPOAuthConfig = {
    authorization_endpoint: 'https://mcp.dropi.co/login/authorize',
    token_endpoint: 'https://mcp.dropi.co/oauth/token',
    revocation_endpoint: 'https://mcp.dropi.co/oauth/revoke',
    client_id_ref: 'platform_setting:dropi_oauth_client_id',
    scope: 'mcp',
    resource: 'https://mcp.dropi.co/mcp',
    ...(discovery ? { discovery } : {}),
    ...over,
  };
  return {
    id: 'dropi', name: 'Dropi', match_url_pattern: 'mcp.dropi.co', match_strategy: 'domain_exact',
    default_transport: 'streamable-http', default_server_url: 'https://mcp.dropi.co/mcp',
    auto_injected_headers: [], user_configurable_headers: [], supported_events: [],
    requires_oauth_connect: true, health_check_tool: null, is_active: true,
    oauth_config, allowed_org_ids: [], default_selected_tools: null,
  };
}

type Doc = Record<string, unknown> | Error;

/** Fake fetch (scripted per URL), in-memory KV with TTL bookkeeping, captured logs. */
function fakeDiscovery(docs: Record<string, Doc> = { [PRM_URL]: DROPI_PRM, [ASM_URL]: DROPI_ASM }) {
  const kv = new Map<string, { value: string; ttl: number }>();
  const fetched: string[] = [];
  const logs: string[] = [];
  const routes = { ...docs };
  const deps: DiscoveryDeps = {
    fetchJson: async (url) => {
      fetched.push(url);
      const doc = routes[url];
      if (doc === undefined) throw new Error('metadata HTTP 404');
      if (doc instanceof Error) throw doc;
      return JSON.parse(JSON.stringify(doc)) as Record<string, unknown>;
    },
    kv: {
      get: async (k) => kv.get(k)?.value ?? null,
      setEx: async (k, v, s) => { kv.set(k, { value: v, ttl: s }); },
      setNx: async (k, v, s) => { if (kv.has(k)) return false; kv.set(k, { value: v, ttl: s }); return true; },
    },
    log: { info: (m) => logs.push(m), warn: (m) => logs.push(m), error: (m) => logs.push(m) },
  };
  return { deps, kv, fetched, logs, routes };
}

const keysFor = (profile: MCPProviderProfile) =>
  discoveryCacheKeys(
    profile.id,
    profile.oauth_config!.resource!,
    profile.oauth_config!.discovery!.allowed_host_suffixes,
    staticEndpoints(profile.oauth_config!)
  );

// ── 1. Real Dropi metadata ───────────────────────────────────────────────────

test('discovery: real Dropi metadata → mcp.dropi.co endpoints, source discovered, the two well-known URLs', async () => {
  const f = fakeDiscovery();
  const r = await resolveOAuthEndpointsCore(f.deps, dropiProfile());
  assert.deepEqual(r, {
    authorizationEndpoint: 'https://mcp.dropi.co/login/authorize',
    tokenEndpoint: 'https://mcp.dropi.co/oauth/token',
    revocationEndpoint: 'https://mcp.dropi.co/oauth/revoke',
    source: 'discovered',
  });
  assert.deepEqual(f.fetched, [PRM_URL, ASM_URL]);
  const k = keysFor(dropiProfile());
  assert.equal(f.kv.get(k.fresh)?.ttl, FRESH_TTL_SECONDS);
  assert.equal(f.kv.get(k.lastGood)?.ttl, LAST_GOOD_TTL_SECONDS);
  assert.equal(f.logs.length, 0, 'same as static → no drift alert');
});

test('well-known URLs follow RFC 9728 / RFC 8414 path insertion', () => {
  assert.equal(protectedResourceMetadataUrl(new URL('https://mcp.dropi.co/mcp')), PRM_URL);
  assert.equal(authorizationServerMetadataUrl(new URL('https://mcp.dropi.co')), ASM_URL);
  assert.equal(authorizationServerMetadataUrl(new URL('https://as.dropi.co/tenant1/')), 'https://as.dropi.co/.well-known/oauth-authorization-server/tenant1');
});

// ── 2. Profiles without discovery ────────────────────────────────────────────

test('discovery off (absent or enabled=false) → static endpoints, no request at all', async () => {
  for (const profile of [dropiProfile({}, null), dropiProfile({}, { enabled: false, allowed_host_suffixes: ['dropi.co'] })]) {
    const f = fakeDiscovery();
    const r = await resolveOAuthEndpointsCore(f.deps, profile);
    assert.equal(r.source, 'static');
    assert.equal(r.tokenEndpoint, 'https://mcp.dropi.co/oauth/token');
    assert.equal(f.fetched.length, 0);
    assert.equal(f.kv.size, 0);
  }
});

// ── 3/4. Rejections ──────────────────────────────────────────────────────────

const REJECTIONS: Array<[string, Record<string, unknown> | null, Record<string, unknown> | null, RegExp]> = [
  ['issuer mismatch', null, { issuer: 'https://other.dropi.co' }, /issuer mismatch/],
  ['AS host evil.com', { authorization_servers: ['https://evil.com'] }, null, /host not allowed: evil\.com/],
  ['AS host dropi.co.evil.com', { authorization_servers: ['https://dropi.co.evil.com'] }, null, /host not allowed: dropi\.co\.evil\.com/],
  ['AS host notdropi.co', { authorization_servers: ['https://notdropi.co'] }, null, /host not allowed: notdropi\.co/],
  ['AS over http', { authorization_servers: ['http://mcp.dropi.co'] }, null, /not https/],
  ['AS with port', { authorization_servers: ['https://mcp.dropi.co:8443'] }, null, /non-default port/],
  ['authorize on evil.com', null, { authorization_endpoint: 'https://evil.com/authorize' }, /host not allowed: evil\.com/],
  ['token on notdropi.co', null, { token_endpoint: 'https://notdropi.co/oauth/token' }, /host not allowed: notdropi\.co/],
  ['revoke on dropi.co.evil.com', null, { revocation_endpoint: 'https://dropi.co.evil.com/revoke' }, /host not allowed/],
  ['token over http', null, { token_endpoint: 'http://mcp.dropi.co/oauth/token' }, /token_endpoint is not https/],
  ['token with port', null, { token_endpoint: 'https://mcp.dropi.co:444/oauth/token' }, /non-default port/],
  ['token with credentials', null, { token_endpoint: 'https://u:p@mcp.dropi.co/oauth/token' }, /credentials/],
  ['token on an IP', null, { token_endpoint: 'https://1.2.3.4/oauth/token' }, /host not allowed/],
  ['authorize with control chars', null, { authorization_endpoint: 'https://mcp.dropi.co/login\n/authorize' }, /control characters/],
  ['no S256', null, { code_challenge_methods_supported: ['plain'] }, /S256/],
  ['no S256 (absent)', null, { code_challenge_methods_supported: undefined }, /S256/],
  ['no public client', null, { token_endpoint_auth_methods_supported: ['client_secret_basic'] }, /none/],
  ['token endpoint missing', null, { token_endpoint: undefined }, /token_endpoint missing/],
  ['resource mismatch', { resource: 'https://mcp.dropi.co/other' }, null, /resource mismatch/],
  ['authorization_servers empty', { authorization_servers: [] }, null, /authorization_servers missing/],
];

for (const [name, prmPatch, asmPatch, reason] of REJECTIONS) {
  test(`discovery rejected (${name}) → ALERT with reason, negative cache, static fallback, no throw`, async () => {
    const f = fakeDiscovery({
      [PRM_URL]: { ...DROPI_PRM, ...(prmPatch ?? {}) },
      [ASM_URL]: { ...DROPI_ASM, ...(asmPatch ?? {}) },
    });
    const profile = dropiProfile(OLD_STATIC);
    const r = await resolveOAuthEndpointsCore(f.deps, profile);
    assert.equal(r.source, 'static');
    assert.equal(r.tokenEndpoint, OLD_STATIC.token_endpoint);
    const alert = f.logs.find((l) => l.includes('ALERT discovery rejected for provider dropi'));
    assert.ok(alert, `ALERT expected, got ${JSON.stringify(f.logs)}`);
    assert.match(alert, reason);
    assert.ok(!f.logs.some((l) => l.includes('endpoint drift')), 'rejected values never produce drift alerts');
    assert.equal(f.kv.get(keysFor(profile).negative)?.ttl, NEGATIVE_TTL_SECONDS);
    assert.equal(f.kv.get(keysFor(profile).fresh), undefined, 'rejected values are never cached');
  });
}

test('authorization_servers: the first allowed entry is used (foreign ones are skipped)', async () => {
  const f = fakeDiscovery({ [PRM_URL]: { ...DROPI_PRM, authorization_servers: ['https://evil.com', 'https://mcp.dropi.co'] }, [ASM_URL]: DROPI_ASM });
  const r = await resolveOAuthEndpointsCore(f.deps, dropiProfile());
  assert.equal(r.source, 'discovered');
  assert.deepEqual(f.fetched, [PRM_URL, ASM_URL]);
});

test('a subdomain move inside dropi.co is accepted (the 2026-11-19 case)', async () => {
  const asm = { ...DROPI_ASM, authorization_endpoint: 'https://auth2.dropi.co/authorize', token_endpoint: 'https://auth2.dropi.co/token' };
  const f = fakeDiscovery({ [PRM_URL]: DROPI_PRM, [ASM_URL]: asm });
  const r = await resolveOAuthEndpointsCore(f.deps, dropiProfile());
  assert.equal(r.source, 'discovered');
  assert.equal(r.tokenEndpoint, 'https://auth2.dropi.co/token');
});

test('a rejected discovery falls back to the last good value when there is one', async () => {
  const f = fakeDiscovery();
  const profile = dropiProfile(OLD_STATIC);
  await resolveOAuthEndpointsCore(f.deps, profile);
  f.routes[ASM_URL] = { ...DROPI_ASM, issuer: 'https://evil.com' };
  const r = await resolveOAuthEndpointsCore(f.deps, profile, { forceRefresh: true });
  assert.equal(r.source, 'cached');
  assert.equal(r.tokenEndpoint, 'https://mcp.dropi.co/oauth/token');
});

// ── 5. Transport failures (fake) ─────────────────────────────────────────────

for (const [name, err] of [
  ['timeout', new Error('metadata request timed out')],
  ['HTTP 500', new Error('metadata HTTP 500')],
  ['invalid JSON', new Error('metadata is not valid JSON')],
  ['too large', new Error('metadata response too large')],
  ['redirect', new TypeError('fetch failed')],
] as const) {
  test(`discovery fetch failure (${name}) → fallback, negative cache, no exception; next call does not refetch`, async () => {
    const f = fakeDiscovery({ [PRM_URL]: err, [ASM_URL]: DROPI_ASM });
    const profile = dropiProfile(OLD_STATIC);
    const r = await resolveOAuthEndpointsCore(f.deps, profile);
    assert.equal(r.source, 'static');
    assert.equal(f.kv.get(keysFor(profile).negative)?.ttl, NEGATIVE_TTL_SECONDS);
    assert.ok(f.logs.some((l) => l.includes('Discovery failed for provider dropi')));
    const fetchedBefore = f.fetched.length;
    const again = await resolveOAuthEndpointsCore(f.deps, profile);
    assert.equal(again.source, 'static');
    assert.equal(f.fetched.length, fetchedBefore, 'negative cache avoids hitting the provider again');
  });
}

test('KV failures never break resolution (Redis down → discovery still works, no throw)', async () => {
  const f = fakeDiscovery();
  f.deps.kv = {
    get: async () => { throw new Error('redis down'); },
    setEx: async () => { throw new Error('redis down'); },
    setNx: async () => { throw new Error('redis down'); },
  };
  const r = await resolveOAuthEndpointsCore(f.deps, dropiProfile());
  assert.equal(r.source, 'discovered');
});

test('invalid allow-list at runtime → static, no request', async () => {
  const f = fakeDiscovery();
  const r = await resolveOAuthEndpointsCore(f.deps, dropiProfile({}, { enabled: true, allowed_host_suffixes: ['*.dropi.co'] }));
  assert.equal(r.source, 'static');
  assert.equal(f.fetched.length, 0);
});

// ── 6. Cache ─────────────────────────────────────────────────────────────────

test('cache: second call makes no request; forceRefresh does; last good is used when discovery fails', async () => {
  const f = fakeDiscovery();
  const profile = dropiProfile();
  assert.equal((await resolveOAuthEndpointsCore(f.deps, profile)).source, 'discovered');
  assert.equal(f.fetched.length, 2);
  const cached = await resolveOAuthEndpointsCore(f.deps, profile);
  assert.equal(cached.source, 'cached');
  assert.equal(cached.tokenEndpoint, 'https://mcp.dropi.co/oauth/token');
  assert.equal(f.fetched.length, 2);
  assert.equal((await resolveOAuthEndpointsCore(f.deps, profile, { forceRefresh: true })).source, 'discovered');
  assert.equal(f.fetched.length, 4);

  // Fresh entry expired + provider down → last good (30 d), not the static values.
  f.kv.delete(keysFor(profile).fresh);
  f.routes[PRM_URL] = new Error('metadata HTTP 503');
  // Same oauth_config (a different static config has its own keys: see D-02).
  const fallback = await resolveOAuthEndpointsCore(f.deps, profile);
  assert.equal(fallback.source, 'cached');
  assert.equal(fallback.tokenEndpoint, 'https://mcp.dropi.co/oauth/token');
});

test('D-06: forceRefresh honours the negative cache (failure < 5 min → no request, fallback)', async () => {
  const f = fakeDiscovery({ [PRM_URL]: new Error('metadata HTTP 500'), [ASM_URL]: DROPI_ASM });
  const profile = dropiProfile();
  await resolveOAuthEndpointsCore(f.deps, profile);
  assert.equal(f.fetched.length, 1);
  f.routes[PRM_URL] = DROPI_PRM;
  assert.equal((await resolveOAuthEndpointsCore(f.deps, profile)).source, 'static', 'negative cache honoured');
  assert.equal((await resolveOAuthEndpointsCore(f.deps, profile, { forceRefresh: true })).source, 'static', 'also when forced');
  assert.equal(f.fetched.length, 1, 'no new request while the negative cache lives');
  // A forced failure also writes the negative cache.
  f.kv.delete(keysFor(profile).negative);
  f.routes[PRM_URL] = new Error('metadata HTTP 503');
  assert.equal((await resolveOAuthEndpointsCore(f.deps, profile, { forceRefresh: true })).source, 'static');
  assert.equal(f.kv.get(keysFor(profile).negative)?.ttl, NEGATIVE_TTL_SECONDS);
  // Expired → discovery runs again.
  f.kv.delete(keysFor(profile).negative);
  f.routes[PRM_URL] = DROPI_PRM;
  assert.equal((await resolveOAuthEndpointsCore(f.deps, profile, { forceRefresh: true })).source, 'discovered');
});

test('D-06: a forced discovery < 5 min old is reused by the next forced call (one request pair)', async () => {
  const f = fakeDiscovery();
  const profile = dropiProfile();
  const a = await resolveOAuthEndpointsCore(f.deps, profile, { forceRefresh: true });
  const b = await resolveOAuthEndpointsCore(f.deps, profile, { forceRefresh: true });
  assert.equal(a.source, 'discovered');
  assert.equal(b.source, 'discovered', 'still a fresh discovery: a moved endpoint can be retried by other tools');
  assert.equal(b.tokenEndpoint, a.tokenEndpoint);
  assert.equal(f.fetched.length, 2);
  // The reused value is re-validated against the current allow-list like any cached value.
  f.kv.set(keysFor(profile).forced, { value: JSON.stringify({ authorizationEndpoint: 'https://evil.com/a', tokenEndpoint: 'https://evil.com/t' }), ttl: 1 });
  const c = await resolveOAuthEndpointsCore(f.deps, profile, { forceRefresh: true });
  assert.equal(c.tokenEndpoint, 'https://mcp.dropi.co/oauth/token');
  assert.equal(f.fetched.length, 4);
});

test('D-06: ALERT discovery rejected is deduplicated per provider and reason (24 h)', async () => {
  const f = fakeDiscovery({ [PRM_URL]: DROPI_PRM, [ASM_URL]: { ...DROPI_ASM, issuer: 'https://evil.com' } });
  const profile = dropiProfile();
  const rejected = () => f.logs.filter((l) => l.includes('ALERT discovery rejected'));
  for (let i = 0; i < 3; i++) {
    await resolveOAuthEndpointsCore(f.deps, profile);
    f.kv.delete(keysFor(profile).negative);
  }
  assert.equal(f.fetched.length, 6, 'three real attempts');
  assert.equal(rejected().length, 1, 'one alert for the same reason');
  const alertKey = [...f.kv.keys()].find((k) => k.includes('rejected-alert:dropi:'));
  assert.equal(f.kv.get(alertKey!)?.ttl, 24 * 60 * 60);
  f.routes[ASM_URL] = { ...DROPI_ASM, code_challenge_methods_supported: ['plain'] };
  await resolveOAuthEndpointsCore(f.deps, profile);
  assert.equal(rejected().length, 2, 'a different reason is a new alert');
});

test('cache: a cached value outside the CURRENT allow-list is ignored', async () => {
  const f = fakeDiscovery();
  const profile = dropiProfile();
  const k = keysFor(profile);
  f.kv.set(k.fresh, { value: JSON.stringify({ authorizationEndpoint: 'https://evil.com/a', tokenEndpoint: 'https://evil.com/t' }), ttl: 1 });
  const r = await resolveOAuthEndpointsCore(f.deps, profile);
  assert.equal(r.source, 'discovered');
  assert.equal(r.tokenEndpoint, 'https://mcp.dropi.co/oauth/token');
});

test('cache keys change when the resource, the allow-list or any static endpoint change', () => {
  const st = staticEndpoints(dropiProfile().oauth_config!);
  const a = discoveryCacheKeys('dropi', 'https://mcp.dropi.co/mcp', ['dropi.co'], st);
  assert.notEqual(a.fresh, discoveryCacheKeys('dropi', 'https://mcp.dropi.co/mcp2', ['dropi.co'], st).fresh);
  assert.notEqual(a.fresh, discoveryCacheKeys('dropi', 'https://mcp.dropi.co/mcp', ['dropi.co', 'dropi.com'], st).fresh);
  for (const field of ['authorizationEndpoint', 'tokenEndpoint', 'revocationEndpoint'] as const) {
    const changed = { ...st, [field]: 'https://mcp.dropi.co/changed' };
    const k = discoveryCacheKeys('dropi', 'https://mcp.dropi.co/mcp', ['dropi.co'], changed);
    assert.notEqual(a.fresh, k.fresh, field);
    assert.notEqual(a.lastGood, k.lastGood, field);
  }
  assert.notEqual(a.fresh, discoveryCacheKeys('dropi', 'https://mcp.dropi.co/mcp', ['dropi.co'], { ...st, revocationEndpoint: undefined }).fresh);
});

test('D-02: a migration that changes a static endpoint stops the previous last good value from being used', async () => {
  const f = fakeDiscovery();
  const before = dropiProfile();
  assert.equal((await resolveOAuthEndpointsCore(f.deps, before)).source, 'discovered');
  // Provider now unreachable; the stored last good would win over static...
  f.routes[PRM_URL] = new Error('metadata HTTP 503');
  f.kv.delete(keysFor(before).fresh);
  assert.equal((await resolveOAuthEndpointsCore(f.deps, before)).source, 'cached');
  // ...until a migration fixes the static token endpoint: the new config has its own (empty) keys.
  const fixed = dropiProfile({ token_endpoint: 'https://mcp.dropi.co/oauth2/token' });
  const r = await resolveOAuthEndpointsCore(f.deps, fixed);
  assert.equal(r.source, 'static');
  assert.equal(r.tokenEndpoint, 'https://mcp.dropi.co/oauth2/token');
});

test('D-03: metadata without revocation_endpoint → the static one is used (discovered, fresh cache and last good)', async () => {
  const { revocation_endpoint: _omit, ...asmNoRevoke } = DROPI_ASM;
  void _omit;
  const f = fakeDiscovery({ [PRM_URL]: DROPI_PRM, [ASM_URL]: asmNoRevoke });
  const profile = dropiProfile({ revocation_endpoint: 'https://mcp.dropi.co/oauth/revoke-static' });
  const discovered = await resolveOAuthEndpointsCore(f.deps, profile);
  assert.equal(discovered.source, 'discovered');
  assert.equal(discovered.revocationEndpoint, 'https://mcp.dropi.co/oauth/revoke-static');
  const cached = await resolveOAuthEndpointsCore(f.deps, profile);
  assert.equal(cached.source, 'cached');
  assert.equal(cached.revocationEndpoint, 'https://mcp.dropi.co/oauth/revoke-static');
  f.kv.delete(keysFor(profile).fresh);
  f.routes[PRM_URL] = new Error('metadata HTTP 503');
  const lastGood = await resolveOAuthEndpointsCore(f.deps, profile);
  assert.equal(lastGood.source, 'cached');
  assert.equal(lastGood.revocationEndpoint, 'https://mcp.dropi.co/oauth/revoke-static');
  // A discovered revocation endpoint still wins over the static one.
  const g = fakeDiscovery();
  const r = await resolveOAuthEndpointsCore(g.deps, profile);
  assert.equal(r.revocationEndpoint, 'https://mcp.dropi.co/oauth/revoke');
  // Neither discovered nor static → none.
  const h = fakeDiscovery({ [PRM_URL]: DROPI_PRM, [ASM_URL]: asmNoRevoke });
  const none = await resolveOAuthEndpointsCore(h.deps, dropiProfile({ revocation_endpoint: undefined }));
  assert.equal(none.revocationEndpoint, undefined);
});

test('D-12: a static endpoint that only differs in normalization (case, :443) is not a drift', async () => {
  const f = fakeDiscovery();
  await resolveOAuthEndpointsCore(f.deps, dropiProfile({
    authorization_endpoint: 'https://MCP.dropi.co:443/login/authorize',
    token_endpoint: 'https://mcp.DROPI.co/oauth/token',
  }));
  assert.equal(f.logs.filter((l) => l.includes('endpoint drift')).length, 0);
});

// ── 7. Drift alert ───────────────────────────────────────────────────────────

test('drift: one ALERT per distinct change (and a new one when the change is different)', async () => {
  const f = fakeDiscovery();
  const profile = dropiProfile(OLD_STATIC);
  const r = await resolveOAuthEndpointsCore(f.deps, profile);
  assert.equal(r.source, 'discovered');
  const drift = () => f.logs.filter((l) => l.includes('ALERT endpoint drift'));
  assert.equal(drift().length, 3);
  assert.ok(drift().includes(
    '[mcp-oauth] ALERT endpoint drift for provider dropi: token_endpoint static=https://integrations.dropi.co/oauth/token discovered=https://mcp.dropi.co/oauth/token'
  ));
  await resolveOAuthEndpointsCore(f.deps, profile, { forceRefresh: true });
  f.kv.delete(keysFor(profile).forced);
  await resolveOAuthEndpointsCore(f.deps, profile, { forceRefresh: true });
  assert.equal(drift().length, 3, 'same change → no new alert');

  f.kv.delete(keysFor(profile).forced);
  f.routes[ASM_URL] = { ...DROPI_ASM, token_endpoint: 'https://mcp.dropi.co/oauth2/token' };
  await resolveOAuthEndpointsCore(f.deps, profile, { forceRefresh: true });
  assert.equal(drift().length, 4, 'a different token endpoint is a new alert');
});

// ── Config parsing / allow-list helpers ──────────────────────────────────────

test('parseOAuthDiscoveryConfig: valid config kept; invalid ones disable discovery', () => {
  assert.deepEqual(parseOAuthDiscoveryConfig({ enabled: true, allowed_host_suffixes: ['dropi.co'] }), { enabled: true, allowed_host_suffixes: ['dropi.co'] });
  assert.equal(parseOAuthDiscoveryConfig(undefined), undefined);
  const origError = console.error;
  console.error = () => {};
  try {
    for (const bad of [
      'yes', [], { enabled: 'true', allowed_host_suffixes: ['dropi.co'] }, { enabled: true },
      { enabled: true, allowed_host_suffixes: [] }, { enabled: true, allowed_host_suffixes: ['Dropi.co'] },
      { enabled: true, allowed_host_suffixes: ['*.dropi.co'] }, { enabled: true, allowed_host_suffixes: [''] },
      { enabled: true, allowed_host_suffixes: ['co'] }, { enabled: true, allowed_host_suffixes: ['3.4'] },
      { enabled: true, allowed_host_suffixes: ['.dropi.co'] }, { enabled: true, allowed_host_suffixes: [1] },
    ]) {
      assert.equal(parseOAuthDiscoveryConfig(bad), undefined, JSON.stringify(bad));
    }
  } finally {
    console.error = origError;
  }
});

test('hostAllowed: exact or subdomain only; look-alikes and IPs are refused', () => {
  assert.equal(isValidHostSuffix('dropi.co'), true);
  for (const h of ['dropi.co', 'mcp.dropi.co', 'a.b.dropi.co']) assert.equal(hostAllowed(h, ['dropi.co']), true, h);
  for (const h of ['evil.com', 'dropi.co.evil.com', 'notdropi.co', 'dropi.com', 'mcp.dropi.co.', '1.2.3.4', '']) {
    assert.equal(hostAllowed(h, ['dropi.co']), false, h);
  }
});

test('toPublicProfile never exposes oauth_config (and so not discovery)', () => {
  const pub = toPublicProfile(dropiProfile()) as Record<string, unknown>;
  assert.equal(pub['oauth_config'], undefined);
  assert.ok(!JSON.stringify(pub).includes('allowed_host_suffixes'));
});

// ── 5. The real metadata fetcher (local HTTP server) ─────────────────────────

process.env['SSRF_ALLOW_PRIVATE'] = 'true';
if (process.env['NODE_ENV'] === 'production') process.env['NODE_ENV'] = 'test';

async function withServer(handler: http.RequestListener, fn: (base: string, seen: http.IncomingHttpHeaders[]) => Promise<void>) {
  const seen: http.IncomingHttpHeaders[] = [];
  const server = http.createServer((req, res) => { seen.push(req.headers); handler(req, res); });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  const { port } = server.address() as AddressInfo;
  try {
    await fn(`http://127.0.0.1:${port}`, seen);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
  }
}

test('fetchMetadataJson: 200 JSON object → parsed; GET with Accept JSON and no credentials', async () => {
  await withServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ method: req.method, ...DROPI_PRM }));
  }, async (base, seen) => {
    const body = await fetchMetadataJson(`${base}/.well-known/oauth-protected-resource/mcp`);
    assert.equal(body['method'], 'GET');
    assert.equal(body['resource'], DROPI_PRM.resource);
    assert.equal(seen[0]!['accept'], 'application/json');
    assert.equal(seen[0]!['authorization'], undefined);
    assert.equal(seen[0]!['cookie'], undefined);
  });
});

for (const [name, handler, expected] of [
  ['HTTP 500', (_q: http.IncomingMessage, s: http.ServerResponse) => { s.statusCode = 500; s.end('{}'); }, /HTTP 500/],
  ['invalid JSON', (_q: http.IncomingMessage, s: http.ServerResponse) => { s.end('<html>'); }, /not valid JSON/],
  ['JSON array', (_q: http.IncomingMessage, s: http.ServerResponse) => { s.end('[1]'); }, /not a JSON object/],
  ['declared > 64 KB', (_q: http.IncomingMessage, s: http.ServerResponse) => {
    const big = JSON.stringify({ pad: 'x'.repeat(DISCOVERY_MAX_BYTES) });
    s.setHeader('Content-Length', String(Buffer.byteLength(big)));
    s.end(big);
  }, /too large/],
  ['chunked > 64 KB', (_q: http.IncomingMessage, s: http.ServerResponse) => {
    s.write('{"pad":"');
    for (let i = 0; i < 20; i++) s.write('x'.repeat(8 * 1024));
    s.end('"}');
  }, /too large/],
  ['redirect', (_q: http.IncomingMessage, s: http.ServerResponse) => { s.statusCode = 302; s.setHeader('Location', 'https://evil.com/'); s.end(); }, /fetch failed|redirect/i],
] as const) {
  test(`fetchMetadataJson rejects: ${name}`, async () => {
    await withServer(handler, async (base) => {
      await assert.rejects(fetchMetadataJson(`${base}/x`), expected);
    });
  });
}

test('fetchMetadataJson: timeout (server never answers) → rejects within the budget', async () => {
  await withServer(() => { /* never respond */ }, async (base) => {
    const t0 = Date.now();
    await assert.rejects(fetchMetadataJson(`${base}/x`, { timeoutMs: 200 }), /timed out/);
    assert.ok(Date.now() - t0 < 2_000);
  });
});

test('D-01: fetchMetadataJson: a slow DNS check counts inside the same timeout', async () => {
  const t0 = Date.now();
  await assert.rejects(
    fetchMetadataJson('https://mcp.dropi.co/.well-known/x', { timeoutMs: 200, assertUrl: () => new Promise(() => { /* DNS never answers */ }) }),
    /timed out/
  );
  const elapsed = Date.now() - t0;
  assert.ok(elapsed >= 150 && elapsed < 1_500, `elapsed ${elapsed} ms`);
});

test('D-01: fetchMetadataJson: a DNS check that eats part of the budget leaves only the rest for the request', async () => {
  await withServer(() => { /* never respond */ }, async (base) => {
    const t0 = Date.now();
    await assert.rejects(
      fetchMetadataJson(`${base}/x`, { timeoutMs: 300, assertUrl: () => new Promise((r) => setTimeout(r, 200)) }),
      /timed out/
    );
    assert.ok(Date.now() - t0 < 1_000, 'total stays within one budget, not DNS + budget');
  });
});

// ── D-08: token endpoint responses are capped at 64 KB ───────────────────────

test('D-08: postForm caps the token response at 64 KB → body null (2xx = unreadable token response)', async () => {
  const origWarn = console.warn;
  const warned: string[] = [];
  console.warn = (m: string) => { warned.push(m); };
  try {
    await withServer((_q, s) => {
      s.setHeader('Content-Type', 'application/json');
      s.write('{"access_token":"');
      for (let i = 0; i < 10; i++) s.write('x'.repeat(8 * 1024));
      s.end('","refresh_token":"r","expires_in":3600}');
    }, async (base) => {
      const res = await postForm(`${base}/token`, { grant_type: 'refresh_token', refresh_token: 'RT-secret' });
      assert.equal(res.status, 200);
      assert.equal(res.body, null);
    });
    assert.ok(warned.some((l) => l.includes(`over ${TOKEN_RESPONSE_MAX_BYTES} bytes`)));
    assert.ok(warned.every((l) => !l.includes('RT-secret')));
    // A normal-sized response is parsed as before.
    await withServer((_q, s) => { s.statusCode = 400; s.end(JSON.stringify({ error: 'invalid_grant' })); }, async (base) => {
      const res = await postForm(`${base}/token`, { grant_type: 'refresh_token' });
      assert.deepEqual(res.body, { error: 'invalid_grant' });
    });
    // A gzip bomb is capped after decoding.
    const zlib = await import('zlib');
    const bomb = zlib.gzipSync(Buffer.from(`{"pad":"${'x'.repeat(5 * 1024 * 1024)}"}`));
    await withServer((_q, s) => { s.setHeader('Content-Encoding', 'gzip'); s.end(bomb); }, async (base) => {
      const res = await postForm(`${base}/token`, {});
      assert.equal(res.body, null);
    });
  } finally {
    console.warn = origWarn;
  }
});

test('fetchMetadataJson: timeout also covers a body that trickles forever', async () => {
  await withServer((_q, s) => { s.write('{"a":'); /* never ends */ }, async (base) => {
    await assert.rejects(fetchMetadataJson(`${base}/x`, { timeoutMs: 200 }), /timed out/);
  });
});

// ── 9. Wiring: authorize, token, revoke ──────────────────────────────────────

function endpointDeps(resolved: { authorizationEndpoint: string; tokenEndpoint: string; revocationEndpoint?: string; source: 'discovered' | 'cached' | 'static' }) {
  const calls: Array<{ forceRefresh?: boolean }> = [];
  const deps: ProfileEndpointDeps = {
    resolveEndpoints: async (_p, opts) => { calls.push({ forceRefresh: opts?.forceRefresh }); return resolved; },
    resolveClientId: async () => 'gensmart-client',
  };
  return { deps, calls };
}

const DISCOVERED = {
  authorizationEndpoint: 'https://auth2.dropi.co/login/authorize',
  tokenEndpoint: 'https://auth2.dropi.co/oauth/token',
  revocationEndpoint: 'https://auth2.dropi.co/oauth/revoke',
  source: 'discovered' as const,
};

test('startAuthorization: the authorize URL is built on the resolved endpoint; client_id/scope/resource from oauth_config', async () => {
  const profile = dropiProfile(OLD_STATIC);
  const { deps } = endpointDeps(DISCOVERED);
  const config = await authorizeConfigFor(profile, deps);
  const oauthDeps = {
    kv: { setEx: async () => {}, get: async () => null, getDel: async () => null, setNxPx: async () => true, delIfEquals: async () => {}, extendIfEquals: async () => true },
    encrypt: (s: string) => s,
    randomBytes: (n: number) => Buffer.alloc(n, 1),
  } as unknown as OAuthDeps;
  const url = new URL(await startAuthorizationCore(oauthDeps, {
    organizationId: 'o', agentId: 'a', userId: 'u', providerId: 'dropi', redirectUri: 'https://app/cb', config,
  }));
  assert.equal(`${url.origin}${url.pathname}`, 'https://auth2.dropi.co/login/authorize');
  assert.equal(url.searchParams.get('client_id'), 'gensmart-client');
  assert.equal(url.searchParams.get('scope'), 'mcp');
  assert.equal(url.searchParams.get('resource'), 'https://mcp.dropi.co/mcp');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
});

test('tokenEndpointsFor uses the resolved token endpoint; rediscover returns it only when freshly discovered', async () => {
  const profile = dropiProfile(OLD_STATIC);
  const d = endpointDeps(DISCOVERED);
  assert.deepEqual(await tokenEndpointsFor(profile, d.deps), {
    tokenEndpoint: 'https://auth2.dropi.co/oauth/token', clientId: 'gensmart-client', resource: 'https://mcp.dropi.co/mcp',
  });
  assert.equal(await rediscoverTokenEndpoint(profile, d.deps), 'https://auth2.dropi.co/oauth/token');
  assert.deepEqual(d.calls.at(-1), { forceRefresh: true });
  assert.equal(await rediscoverTokenEndpoint(profile, endpointDeps({ ...DISCOVERED, source: 'cached' }).deps), null);
  assert.equal(await rediscoverTokenEndpoint(profile, endpointDeps({ ...DISCOVERED, source: 'static' }).deps), null);
});

test('D-11: rediscoverTokenEndpoint on a profile without discovery → null, no resolution at all', async () => {
  for (const profile of [dropiProfile(OLD_STATIC, null), dropiProfile(OLD_STATIC, { enabled: false, allowed_host_suffixes: ['dropi.co'] })]) {
    const d = endpointDeps(DISCOVERED);
    assert.equal(await rediscoverTokenEndpoint(profile, d.deps), null);
    assert.equal(d.calls.length, 0);
  }
});

function revokeDeps(over: Partial<RevokeDeps> = {}) {
  const posts: Array<{ url: string; body: string }> = [];
  const deps: RevokeDeps = {
    resolveEndpoints: async () => DISCOVERED,
    resolveValueRef: async () => 'gensmart-client',
    decrypt: (t) => t.replace(/^enc:/, ''),
    post: async (url, body) => { posts.push({ url, body }); return { status: 200 }; },
    ...over,
  };
  return { deps, posts };
}

test('revokeOAuthSession posts to the resolved revocation endpoint', async () => {
  const { deps, posts } = revokeDeps();
  const origLog = console.log;
  console.log = () => {};
  try {
    await revokeOAuthSession({ refresh_token_encrypted: 'enc:RT-secret' }, dropiProfile(OLD_STATIC), deps);
  } finally {
    console.log = origLog;
  }
  assert.equal(posts.length, 1);
  assert.equal(posts[0]!.url, 'https://auth2.dropi.co/oauth/revoke');
  assert.match(posts[0]!.body, /token_type_hint=refresh_token/);
});

test('revokeOAuthSession is best-effort: resolution or POST failures never throw; no endpoint → no call', async () => {
  const origWarn = console.warn;
  const warned: string[] = [];
  console.warn = (m: string) => { warned.push(m); };
  try {
    const failing = revokeDeps({ resolveEndpoints: async () => { throw new Error('boom'); } });
    await revokeOAuthSession({ refresh_token_encrypted: 'enc:RT-secret' }, dropiProfile(), failing.deps);
    assert.equal(failing.posts.length, 0);
    const postFails = revokeDeps({ post: async () => { throw new Error('network'); } });
    await revokeOAuthSession({ refresh_token_encrypted: 'enc:RT-secret' }, dropiProfile(), postFails.deps);
    const none = revokeDeps({ resolveEndpoints: async () => ({ ...DISCOVERED, revocationEndpoint: undefined }) });
    await revokeOAuthSession({ refresh_token_encrypted: 'enc:RT-secret' }, dropiProfile(), none.deps);
    assert.equal(none.posts.length, 0);
  } finally {
    console.warn = origWarn;
  }
  assert.ok(warned.every((l) => !l.includes('RT-secret')), 'logs never carry the refresh token');
});

// ── D-06 + D-07 end to end: refresh core + real discovery core ──────────────

test('D-06/D-07: two refreshes with 404 in a row → ONE discovery and ONE alert; tokens untouched', async () => {
  const f = fakeDiscovery();
  const profile = dropiProfile();
  const kv = new Map<string, string>();
  const logs: string[] = [];
  const tokenCalls: string[] = [];
  let row: StoredOAuth = {
    access_token_encrypted: 'enc(a)', refresh_token_encrypted: 'enc(r)', status: 'connected',
    expires_at: new Date(Date.now() - 1000).toISOString(), connected_at: '', updated_at: '',
  };
  const deps = {
    kv: {
      setEx: async () => {}, get: async (k: string) => kv.get(k) ?? null, getDel: async () => null,
      setNxPx: async (k: string, v: string) => { if (kv.has(k)) return false; kv.set(k, v); return true; },
      delIfEquals: async (k: string, v: string) => { if (kv.get(k) === v) kv.delete(k); },
      extendIfEquals: async (k: string, v: string) => kv.get(k) === v,
    },
    loadOAuth: async () => ({ ...row }),
    mergeOAuth: async (_t: string, _a: string, patch: Partial<StoredOAuth>) => { row = { ...row, ...patch }; return true; },
    postForm: async (url: string) => { tokenCalls.push(url); return { status: 404, body: null }; },
    encrypt: (t: string) => `enc(${t})`, decrypt: (t: string) => t.slice(4, -1),
    now: () => Date.now(), sleep: async () => {}, randomBytes: (n: number) => Buffer.alloc(n), randomUUID: () => crypto.randomUUID(),
    log: { info: (m: string) => logs.push(m), warn: (m: string) => logs.push(m), error: (m: string) => logs.push(m) },
  } as unknown as OAuthDeps;
  const endpointDepsReal: ProfileEndpointDeps = {
    resolveEndpoints: (p, opts) => resolveOAuthEndpointsCore(f.deps, p, opts),
    resolveClientId: async () => 'gensmart-client',
  };
  const input = {
    toolId: 't1', agentId: 'a1', providerId: 'dropi',
    getEndpoints: () => tokenEndpointsFor(profile, endpointDepsReal),
    rediscoverTokenEndpoint: () => rediscoverTokenEndpoint(profile, endpointDepsReal),
  };
  // Warm cache, as in production (the normal resolution already ran once).
  await resolveOAuthEndpointsCore(f.deps, profile);
  f.fetched.length = 0;

  await assert.rejects(getValidAccessTokenCore(deps, input), McpOAuthTransientError);
  await assert.rejects(getValidAccessTokenCore(deps, input), McpOAuthTransientError);

  assert.deepEqual(f.fetched, [PRM_URL, ASM_URL], 'one forced discovery for both refreshes');
  assert.deepEqual(tokenCalls, ['https://mcp.dropi.co/oauth/token', 'https://mcp.dropi.co/oauth/token'], 'no retry: same endpoint');
  assert.equal(logs.filter((l) => l.includes('ALERT token endpoint returned 404 for provider dropi')).length, 1);
  assert.equal(row.refresh_token_encrypted, 'enc(r)');
  assert.equal(row.status, 'connected');
});
