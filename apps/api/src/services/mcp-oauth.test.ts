/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers tests at import */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import {
  base64url,
  codeChallengeS256,
  generatePkce,
  startAuthorizationCore,
  consumeState,
  getValidAccessTokenCore,
  executeWithOAuthCore,
  isRevokedToolResult,
  McpOAuthReconnectRequiredError,
  McpOAuthTransientError,
  McpOAuthStateError,
  OAUTH_UNAVAILABLE_MESSAGE,
  STATE_KEY_PREFIX,
  type OAuthDeps,
  type StoredOAuth,
  type HttpPostResult,
} from './mcp-oauth.core';
import { toPublicProfile, isProfileVisibleToOrg, type MCPProviderProfile } from './mcp-providers.service';
import { stripOAuthFromConfig } from './agent.service';

const ENDPOINTS = { tokenEndpoint: 'https://t.example/token', clientId: 'cid', resource: 'https://mcp.example/mcp' };

/** Fake infra: in-memory KV (with NX locks), one tool row, scripted token endpoint. */
function fakeWorld(opts: { tokenResponses?: Array<HttpPostResult | Error>; start?: Partial<StoredOAuth> } = {}) {
  const kv = new Map<string, string>();
  let clock = 1_700_000_000_000;
  const enc = (s: string) => `enc(${s})`;
  const dec = (s: string) => s.slice(4, -1);

  let row: StoredOAuth | null = {
    access_token_encrypted: enc('access-old'),
    refresh_token_encrypted: enc('refresh-1'),
    expires_at: new Date(clock - 1000).toISOString(), // expired
    status: 'connected',
    connected_at: new Date(clock - 100000).toISOString(),
    updated_at: new Date(clock - 100000).toISOString(),
    ...opts.start,
  };
  const tokenCalls: Array<{ url: string; form: Record<string, string> }> = [];
  const responses = [...(opts.tokenResponses ?? [])];
  let n = 0;

  const deps: OAuthDeps = {
    kv: {
      setEx: async (k, v) => { kv.set(k, v); },
      getDel: async (k) => { const v = kv.get(k) ?? null; kv.delete(k); return v; },
      setNxPx: async (k, v) => { if (kv.has(k)) return false; kv.set(k, v); return true; },
      delIfEquals: async (k, v) => { if (kv.get(k) === v) kv.delete(k); },
    },
    loadOAuth: async () => (row ? { ...row } : null),
    mergeOAuth: async (_t, _a, patch) => { row = { ...(row as StoredOAuth), ...patch }; },
    postForm: async (url, form) => {
      tokenCalls.push({ url, form });
      await new Promise((r) => setTimeout(r, 20)); // simulate latency so concurrency is real
      const next = responses.shift();
      if (next instanceof Error) throw next;
      if (next) return next;
      n += 1;
      return { status: 200, body: { access_token: `access-${n}`, refresh_token: `refresh-${n + 1}`, expires_in: 3600 } };
    },
    encrypt: enc,
    decrypt: dec,
    now: () => clock,
    sleep: async (ms) => { await new Promise((r) => setTimeout(r, 5)); clock += ms; },
    randomBytes: (k) => crypto.randomBytes(k),
    randomUUID: () => crypto.randomUUID(),
    log: { info: () => {}, warn: () => {}, error: () => {} },
  };
  return { deps, kv, tokenCalls, getRow: () => row, advance: (ms: number) => { clock += ms; } };
}

const tokenInput = { toolId: 't1', agentId: 'a1', getEndpoints: async () => ENDPOINTS };

// ── PKCE ─────────────────────────────────────────────────────────────────────

test('PKCE: challenge is S256 of verifier, base64url without padding', () => {
  const { verifier, challenge } = generatePkce();
  assert.match(verifier, /^[A-Za-z0-9_-]{43}$/);
  assert.match(challenge, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(challenge, base64url(crypto.createHash('sha256').update(verifier).digest()));
  // RFC 7636 appendix B vector
  assert.equal(codeChallengeS256('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
});

// ── State ────────────────────────────────────────────────────────────────────

test('state: authorize URL carries PKCE params and state is single-use', async () => {
  const w = fakeWorld();
  const url = new URL(await startAuthorizationCore(w.deps, {
    organizationId: 'o1', agentId: 'a1', providerId: 'dropi', redirectUri: 'http://localhost:4000/api/oauth/dropi/callback',
    config: { authorizationEndpoint: 'https://oauth.example/authorize', clientId: 'cid', scope: 'mcp', resource: 'https://mcp.example/mcp' },
  }));
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('scope'), 'mcp');
  assert.equal(url.searchParams.get('resource'), 'https://mcp.example/mcp');
  const state = url.searchParams.get('state') as string;
  assert.match(state, /^[a-f0-9]{48}$/);

  const stored = w.kv.get(STATE_KEY_PREFIX + state) as string;
  assert.ok(stored.startsWith('enc('), 'state payload is encrypted');
  const payload = await consumeState(w.deps, state);
  assert.equal(payload.agentId, 'a1');
  assert.equal(codeChallengeS256(payload.codeVerifier), url.searchParams.get('code_challenge'));
  await assert.rejects(() => consumeState(w.deps, state), McpOAuthStateError); // reused
});

test('state: unknown or malformed state is rejected', async () => {
  const w = fakeWorld();
  await assert.rejects(() => consumeState(w.deps, 'f'.repeat(48)), McpOAuthStateError);
  await assert.rejects(() => consumeState(w.deps, 'nope'), McpOAuthStateError);
});

// ── Refresh ──────────────────────────────────────────────────────────────────

test('fresh token is returned without calling the token endpoint', async () => {
  const w = fakeWorld({ start: { expires_at: new Date(1_700_000_000_000 + 3600_000).toISOString() } });
  assert.equal(await getValidAccessTokenCore(w.deps, tokenInput), 'access-old');
  assert.equal(w.tokenCalls.length, 0);
});

test('token expiring in < 5 minutes is refreshed', async () => {
  const w = fakeWorld({ start: { expires_at: new Date(1_700_000_000_000 + 60_000).toISOString() } });
  assert.equal(await getValidAccessTokenCore(w.deps, tokenInput), 'access-1');
  assert.equal(w.tokenCalls.length, 1);
});

test('concurrent refresh: ONE token endpoint call, both callers get the new token', async () => {
  const w = fakeWorld();
  const [a, b] = await Promise.all([
    getValidAccessTokenCore(w.deps, tokenInput),
    getValidAccessTokenCore(w.deps, tokenInput),
  ]);
  assert.equal(w.tokenCalls.length, 1);
  assert.equal(a, 'access-1');
  assert.equal(b, 'access-1');
  assert.equal(w.kv.size, 0, 'lock released');
});

test('rotation: new refresh token persisted; old one is never sent again', async () => {
  const w = fakeWorld();
  await getValidAccessTokenCore(w.deps, tokenInput);
  assert.equal(w.tokenCalls[0]!.form['refresh_token'], 'refresh-1');
  assert.equal(w.tokenCalls[0]!.form['grant_type'], 'refresh_token');
  assert.equal(w.tokenCalls[0]!.form['resource'], ENDPOINTS.resource);
  assert.equal(w.getRow()!.refresh_token_encrypted, 'enc(refresh-2)');

  w.advance(3600_000); // expire again
  await getValidAccessTokenCore(w.deps, tokenInput);
  assert.equal(w.tokenCalls[1]!.form['refresh_token'], 'refresh-2');
  assert.ok(w.tokenCalls.every((c, i) => i === 0 || c.form['refresh_token'] !== 'refresh-1'));
});

test('forceRefresh with the rejected token rotates; if someone else already refreshed, reuses theirs', async () => {
  const w = fakeWorld({ start: { expires_at: new Date(1_700_000_000_000 + 3600_000).toISOString() } });
  // Stored token == rejected one → must refresh
  assert.equal(await getValidAccessTokenCore(w.deps, { ...tokenInput, forceRefresh: true, staleAccessToken: 'access-old' }), 'access-1');
  assert.equal(w.tokenCalls.length, 1);
  // Another caller was also rejected with access-old: stored is now access-1 → no second rotation
  assert.equal(await getValidAccessTokenCore(w.deps, { ...tokenInput, forceRefresh: true, staleAccessToken: 'access-old' }), 'access-1');
  assert.equal(w.tokenCalls.length, 1);
});

test('invalid_grant → needs_reconnect and typed error; later calls do not hit Dropi', async () => {
  const w = fakeWorld({ tokenResponses: [{ status: 400, body: { error: 'invalid_grant' } }] });
  await assert.rejects(() => getValidAccessTokenCore(w.deps, tokenInput), McpOAuthReconnectRequiredError);
  assert.equal(w.getRow()!.status, 'needs_reconnect');
  assert.equal(w.getRow()!.refresh_token_encrypted, 'enc(refresh-1)');
  await assert.rejects(() => getValidAccessTokenCore(w.deps, tokenInput), McpOAuthReconnectRequiredError);
  assert.equal(w.tokenCalls.length, 1);
  assert.equal(w.kv.size, 0, 'lock released');
});

test('5xx and network errors leave tokens intact, release lock, do not mark reconnect', async () => {
  const w = fakeWorld({ tokenResponses: [{ status: 503, body: null }, new Error('ECONNRESET')] });
  const before = { ...w.getRow()! };
  await assert.rejects(() => getValidAccessTokenCore(w.deps, tokenInput), McpOAuthTransientError);
  await assert.rejects(() => getValidAccessTokenCore(w.deps, tokenInput), McpOAuthTransientError);
  assert.deepEqual(w.getRow(), before);
  assert.equal(w.kv.size, 0);
});

test('missing oauth block → reconnect required', async () => {
  const w = fakeWorld();
  w.deps.loadOAuth = async () => null;
  await assert.rejects(() => getValidAccessTokenCore(w.deps, tokenInput), McpOAuthReconnectRequiredError);
});

// ── Revocation / execute wrapper ─────────────────────────────────────────────

test('isRevokedToolResult matches the real Dropi text (case-insensitive)', () => {
  assert.equal(isRevokedToolResult('sesión MCP no válida (token has been revoked): el usuario debe desconectar y volver a conectar el conector Dropi'), true);
  assert.equal(isRevokedToolResult('Token Has Been Revoked'), true);
  assert.equal(isRevokedToolResult('Product list: 3 items'), false);
});

function execDeps(results: Array<{ content: string; isError: boolean }>, tokenFn?: () => Promise<string>) {
  const calls: Array<Record<string, string>> = [];
  let reconnectMarked = 0;
  return {
    calls,
    marked: () => reconnectMarked,
    deps: {
      execute: async (h: Record<string, string>) => { calls.push(h); return results.shift()!; },
      getToken: tokenFn ?? (async () => 'fresh'),
      markNeedsReconnect: async () => { reconnectMarked += 1; },
      log: { info: () => {}, warn: () => {}, error: () => {} },
    },
  };
}

test('execute: HTTP 401 → one forced refresh and exactly one retry', async () => {
  const e = execDeps([
    { content: 'MCP tool execution failed: MCP server returned HTTP 401: x', isError: true },
    { content: 'ok', isError: false },
  ]);
  const r = await executeWithOAuthCore(e.deps, { Authorization: 'Bearer stale' });
  assert.equal(r.content, 'ok');
  assert.equal(e.calls.length, 2);
  assert.equal(e.calls[1]!['Authorization'], 'Bearer fresh');
});

test('execute: second 401 is returned as is (no loop)', async () => {
  const e = execDeps([
    { content: 'HTTP 401', isError: true },
    { content: 'HTTP 401', isError: true },
  ]);
  const r = await executeWithOAuthCore(e.deps, { Authorization: 'Bearer stale' });
  assert.equal(e.calls.length, 2);
  assert.equal(r.isError, true);
});

test('execute: revoked session → needs_reconnect + neutral Spanish message (no technical detail)', async () => {
  const e = execDeps([{ content: 'sesión MCP no válida (token has been revoked): reconecta', isError: true }]);
  const r = await executeWithOAuthCore(e.deps, { Authorization: 'Bearer x' });
  assert.equal(r.content, OAUTH_UNAVAILABLE_MESSAGE);
  assert.equal(e.marked(), 1);
});

test('execute: reconnect-required during 401 refresh → needs_reconnect + neutral message', async () => {
  const e = execDeps([{ content: 'HTTP 401', isError: true }], async () => { throw new McpOAuthReconnectRequiredError(); });
  const r = await executeWithOAuthCore(e.deps, { Authorization: 'Bearer x' });
  assert.equal(r.content, OAUTH_UNAVAILABLE_MESSAGE);
  assert.equal(e.marked(), 1);
});

// ── Exposure ─────────────────────────────────────────────────────────────────

const profile: MCPProviderProfile = {
  id: 'dropi', name: 'Dropi', match_url_pattern: 'mcp.dropi.co', match_strategy: 'domain_exact',
  default_transport: 'streamable-http', default_server_url: 'https://mcp.dropi.co/mcp',
  auto_injected_headers: [], user_configurable_headers: [], supported_events: [],
  requires_oauth_connect: true, health_check_tool: null, is_active: true,
  oauth_config: { authorization_endpoint: 'a', token_endpoint: 't', client_id_ref: 'platform_setting:x', scope: 'mcp' },
  allowed_org_ids: ['org-1'],
};

test('toPublicProfile hides oauth_config/allowed_org_ids and exposes uses_mcp_oauth', () => {
  const pub = toPublicProfile(profile) as unknown as Record<string, unknown>;
  assert.equal('oauth_config' in pub, false);
  assert.equal('allowed_org_ids' in pub, false);
  assert.equal(pub['uses_mcp_oauth'], true);
  assert.equal((toPublicProfile({ ...profile, oauth_config: null }) as unknown as Record<string, unknown>)['uses_mcp_oauth'], false);
});

test('beta gating: null = all orgs, [] = none, list = only those', () => {
  assert.equal(isProfileVisibleToOrg({ allowed_org_ids: null }, 'x'), true);
  assert.equal(isProfileVisibleToOrg({ allowed_org_ids: [] }, 'x'), false);
  assert.equal(isProfileVisibleToOrg({ allowed_org_ids: ['org-1'] }, 'org-1'), true);
  assert.equal(isProfileVisibleToOrg({ allowed_org_ids: ['org-1'] }, 'org-2'), false);
});

test('tool serialization never exposes oauth tokens, only oauth_status', () => {
  const cfg = { server_url: 'u', selected_tools: ['a'], oauth: { access_token_encrypted: 'SECRET1', refresh_token_encrypted: 'SECRET2', status: 'needs_reconnect' } };
  const out = stripOAuthFromConfig(cfg);
  const json = JSON.stringify(out);
  assert.equal(json.includes('SECRET'), false);
  assert.equal((out as Record<string, unknown>)['oauth_status'], 'needs_reconnect');
  assert.equal('oauth' in out, false);
  assert.deepEqual(stripOAuthFromConfig({ server_url: 'u' }), { server_url: 'u' });
});
