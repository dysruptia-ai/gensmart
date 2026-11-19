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
  oauthUnavailableMessage,
  createTicket,
  claimTicket,
  peekState,
  McpOAuthForbiddenError,
  markNeedsReconnectCore,
  withRefreshLockCore,
  selectedToolsAfterConnect,
  buildStoredOAuth,
  jwtSubject,
  revokePreviousIfAccountChangedCore,
  REFRESH_LOCK_PREFIX,
  REFRESH_LOCK_TTL_MS,
  LOCK_WAIT_MAX_MS,
  RETRY_LOCK_EXTEND_MS,
  LOCK_EXTEND_TIMEOUT_MS,
  TOKEN_404_ALERT_PREFIX,
  TOKEN_404_ALERT_TTL_MS,
  oauthErrorCode,
  exchangeAuthorizationCode,
  McpOAuthExchangeError,
  TICKET_KEY_PREFIX,
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
  const extendCalls: Array<{ key: string; ms: number }> = [];
  const responses = [...(opts.tokenResponses ?? [])];
  let n = 0;

  const deps: OAuthDeps = {
    kv: {
      setEx: async (k, v) => { kv.set(k, v); },
      get: async (k) => kv.get(k) ?? null,
      getDel: async (k) => { const v = kv.get(k) ?? null; kv.delete(k); return v; },
      setNxPx: async (k, v) => { if (kv.has(k)) return false; kv.set(k, v); return true; },
      delIfEquals: async (k, v) => { if (kv.get(k) === v) kv.delete(k); },
      extendIfEquals: async (k, v, ms) => { extendCalls.push({ key: k, ms }); return kv.get(k) === v; },
    },
    loadOAuth: async () => (row ? { ...row } : null),
    // Same contract as the SQL: only when the stored session_id equals the expected one (null = legacy).
    mergeOAuth: async (_t, _a, patch, sessionId) => {
      if (!row || (row.session_id ?? null) !== sessionId) return false;
      row = { ...row, ...patch };
      return true;
    },
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
  return {
    deps, kv, tokenCalls, extendCalls,
    getRow: () => row,
    setRow: (r: StoredOAuth) => { row = r; },
    advance: (ms: number) => { clock += ms; },
  };
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
    organizationId: 'o1', agentId: 'a1', userId: 'u1', providerId: 'dropi', redirectUri: 'http://localhost:4000/api/oauth/dropi/callback',
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
      getToken: async () => ({ accessToken: tokenFn ? await tokenFn() : 'fresh', sessionId: 's1' }),
      markNeedsReconnect: async () => { reconnectMarked += 1; },
      providerName: 'Dropi',
      log: { info: () => {}, warn: () => {}, error: () => {} },
    },
  };
}

test('execute: HTTP 401 → one forced refresh and exactly one retry', async () => {
  const e = execDeps([
    { content: 'MCP tool execution failed: MCP server returned HTTP 401: x', isError: true },
    { content: 'ok', isError: false },
  ]);
  const r = await executeWithOAuthCore(e.deps, { Authorization: 'Bearer stale' }, 's1');
  assert.equal(r.content, 'ok');
  assert.equal(e.calls.length, 2);
  assert.equal(e.calls[1]!['Authorization'], 'Bearer fresh');
});

test('execute: second 401 is returned as is (no loop)', async () => {
  const e = execDeps([
    { content: 'HTTP 401', isError: true },
    { content: 'HTTP 401', isError: true },
  ]);
  const r = await executeWithOAuthCore(e.deps, { Authorization: 'Bearer stale' }, 's1');
  assert.equal(e.calls.length, 2);
  assert.equal(r.isError, true);
});

test('execute: revoked session → needs_reconnect + neutral Spanish message (no technical detail)', async () => {
  const e = execDeps([{ content: 'sesión MCP no válida (token has been revoked): reconecta', isError: true }]);
  const r = await executeWithOAuthCore(e.deps, { Authorization: 'Bearer x' }, 's1');
  assert.equal(r.content, oauthUnavailableMessage('Dropi'));
  assert.equal(e.marked(), 1);
});

test('execute: reconnect-required during 401 refresh → needs_reconnect + neutral message', async () => {
  const e = execDeps([{ content: 'HTTP 401', isError: true }], async () => { throw new McpOAuthReconnectRequiredError(); });
  const r = await executeWithOAuthCore(e.deps, { Authorization: 'Bearer x' }, 's1');
  assert.equal(r.content, oauthUnavailableMessage('Dropi'));
  assert.equal(e.marked(), 1);
});

// ── Exposure ─────────────────────────────────────────────────────────────────

const profile: MCPProviderProfile = {
  id: 'dropi', name: 'Dropi', match_url_pattern: 'mcp.dropi.co', match_strategy: 'domain_exact',
  default_transport: 'streamable-http', default_server_url: 'https://mcp.dropi.co/mcp',
  auto_injected_headers: [], user_configurable_headers: [], supported_events: [],
  requires_oauth_connect: true, health_check_tool: null, is_active: true,
  oauth_config: { authorization_endpoint: 'a', token_endpoint: 't', client_id_ref: 'platform_setting:x', scope: 'mcp' },
  allowed_org_ids: ['org-1'], default_selected_tools: null,
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

// ── Hardening (review 02) ────────────────────────────────────────────────────

test('neutral message names the provider and makes no promises', () => {
  const m = oauthUnavailableMessage('Dropi');
  assert.equal(m, 'No pude consultar Dropi en este momento. Intenta de nuevo más tarde.');
  assert.equal(/asesor/i.test(m), false);
});

test('revocation text in a SUCCESSFUL result does not disconnect the tool', async () => {
  const e = execDeps([{ content: 'Producto: "Guía token has been revoked"', isError: false }]);
  const r = await executeWithOAuthCore(e.deps, { Authorization: 'Bearer x' }, 's1');
  assert.equal(r.isError, false);
  assert.equal(r.content.includes('revoked'), true);
  assert.equal(e.marked(), 0);
});

test('lock TTL exceeds HTTP timeout with margin; wait budget covers a full refresh', () => {
  assert.equal(REFRESH_LOCK_TTL_MS, 60_000);
  assert.equal(LOCK_WAIT_MAX_MS, 20_000);
  assert.ok(REFRESH_LOCK_TTL_MS > 15_000 * 2);
});

test('endpoints are resolved BEFORE the lock is taken', async () => {
  const w = fakeWorld();
  const order: string[] = [];
  const origSet = w.deps.kv.setNxPx;
  w.deps.kv.setNxPx = async (k, v, ms) => { order.push('lock'); return origSet(k, v, ms); };
  await getValidAccessTokenCore(w.deps, { ...tokenInput, getEndpoints: async () => { order.push('endpoints'); return ENDPOINTS; } });
  assert.deepEqual(order.slice(0, 2), ['endpoints', 'lock']);
});

async function startedFlow(w: ReturnType<typeof fakeWorld>) {
  const url = new URL(await startAuthorizationCore(w.deps, {
    organizationId: 'o1', agentId: 'a1', userId: 'u1', providerId: 'dropi', redirectUri: 'http://x/cb',
    config: { authorizationEndpoint: 'https://oauth.example/authorize', clientId: 'cid', scope: 'mcp' },
  }));
  return url.searchParams.get('state') as string;
}
const claimInput = (ticket: string, over: Partial<{ organizationId: string; agentId: string; providerId: string; userId: string }> = {}) =>
  ({ ticket, organizationId: 'o1', agentId: 'a1', providerId: 'dropi', userId: 'u1', ...over });

test('callback step: peek does not consume the state and nothing calls the token endpoint', async () => {
  const w = fakeWorld();
  const state = await startedFlow(w);
  const peeked = await peekState(w.deps, state);
  assert.equal(peeked?.agentId, 'a1');
  await createTicket(w.deps, { state, code: 'CODE' });
  assert.ok(w.kv.has(STATE_KEY_PREFIX + state), 'state still available for the authenticated step');
  assert.equal(w.tokenCalls.length, 0);
});

test('ticket is single use; the matching user/org/agent/provider can claim it', async () => {
  const w = fakeWorld();
  const state = await startedFlow(w);
  const ticket = await createTicket(w.deps, { state, code: 'CODE' });
  assert.ok(w.kv.has(TICKET_KEY_PREFIX + ticket));
  const claimed = await claimTicket(w.deps, claimInput(ticket));
  assert.equal(claimed.code, 'CODE');
  assert.equal(claimed.state.userId, 'u1');
  await assert.rejects(() => claimTicket(w.deps, claimInput(ticket)), McpOAuthStateError);
});

for (const [label, over] of [
  ['another org', { organizationId: 'o2' }],
  ['another user', { userId: 'u2' }],
  ['another agent', { agentId: 'a2' }],
  ['another provider', { providerId: 'other' }],
] as const) {
  test(`claim with ${label} is rejected without calling the token endpoint, and cannot be retried`, async () => {
    const w = fakeWorld();
    const state = await startedFlow(w);
    const ticket = await createTicket(w.deps, { state, code: 'CODE' });
    await assert.rejects(() => claimTicket(w.deps, claimInput(ticket, over)), McpOAuthForbiddenError);
    assert.equal(w.tokenCalls.length, 0);
    // ticket and state are burned: even the right user cannot reuse them
    await assert.rejects(() => claimTicket(w.deps, claimInput(ticket)), McpOAuthStateError);
  });
}

test('malformed ticket is rejected', async () => {
  const w = fakeWorld();
  await assert.rejects(() => claimTicket(w.deps, claimInput('nope')), McpOAuthStateError);
});

// ── Audit fixes (prompt 04) ──────────────────────────────────────────────────

const DROPI_TOOLS = [
  'create_order', 'get_order', 'list_orders', 'list_statuses', 'list_products', 'list_categories',
  'quote_shipping', 'search_cities', 'list_departments', 'list_carriers', 'get_customer_fingerprint_profile',
];
const DROPI_DEFAULTS = ['list_products', 'list_categories', 'quote_shipping', 'search_cities', 'list_departments', 'list_carriers', 'list_statuses'];

test('H-01: first connection with default_selected_tools stores the intersection (no PII / order tools)', () => {
  const sel = selectedToolsAfterConnect({ isReconnect: false, discovered: DROPI_TOOLS, profileDefaults: [...DROPI_DEFAULTS, 'not_on_server'] });
  assert.deepEqual([...(sel ?? [])].sort(), [...DROPI_DEFAULTS].sort());
  for (const t of ['create_order', 'get_order', 'list_orders', 'get_customer_fingerprint_profile']) {
    assert.equal(sel!.includes(t), false, `${t} must not be selected by default`);
  }
  assert.equal(sel!.includes('not_on_server'), false);
});

test('H-01: profile without default_selected_tools (NULL) selects every discovered tool', () => {
  assert.deepEqual(selectedToolsAfterConnect({ isReconnect: false, discovered: DROPI_TOOLS, profileDefaults: null }), DROPI_TOOLS);
});

test('H-01: reconnection leaves the stored selection untouched', () => {
  assert.equal(selectedToolsAfterConnect({ isReconnect: true, discovered: DROPI_TOOLS, profileDefaults: DROPI_DEFAULTS }), null);
  assert.equal(selectedToolsAfterConnect({ isReconnect: true, discovered: DROPI_TOOLS, profileDefaults: null }), null);
});

test('H-02: every connection gets a new session_id', () => {
  const w = fakeWorld();
  const t = { accessToken: 'a', refreshToken: 'r', expiresIn: 3600 };
  const a = buildStoredOAuth(w.deps, t);
  const b = buildStoredOAuth(w.deps, t);
  assert.match(a.session_id ?? '', /^[0-9a-f-]{36}$/);
  assert.notEqual(a.session_id, b.session_id);
});

function sessionB(): StoredOAuth {
  return {
    access_token_encrypted: 'enc(access-B)',
    refresh_token_encrypted: 'enc(refresh-B)',
    expires_at: new Date(1_700_000_000_000 + 3600_000).toISOString(),
    status: 'connected',
    connected_at: 'x',
    updated_at: 'x',
    session_id: 'B',
  };
}

test('H-02: a refresh of session A finishing after a reconnection to B does not overwrite B', async () => {
  const w = fakeWorld({ start: { session_id: 'A' } });
  const orig = w.deps.postForm;
  // While A's refresh is in flight (e.g. its lock expired), the tool is reconnected to session B.
  w.deps.postForm = async (url, form) => { const r = await orig(url, form); w.setRow(sessionB()); return r; };
  await assert.rejects(() => getValidAccessTokenCore(w.deps, tokenInput), McpOAuthTransientError);
  assert.deepEqual(w.getRow(), sessionB(), 'session B intact: A tokens discarded, never returned');
  assert.equal(w.kv.size, 0, 'lock released');
});

test('H-02: markNeedsReconnect for session A does not mark session B', async () => {
  const w = fakeWorld();
  w.setRow(sessionB());
  await markNeedsReconnectCore(w.deps, 't1', 'a1', 'A');
  assert.equal(w.getRow()!.status, 'connected');
  await markNeedsReconnectCore(w.deps, 't1', 'a1', 'B');
  assert.equal(w.getRow()!.status, 'needs_reconnect');
});

test('H-02: legacy blocks without session_id are treated as matching', async () => {
  const w = fakeWorld(); // no session_id
  assert.equal(await getValidAccessTokenCore(w.deps, tokenInput), 'access-1');
  assert.equal(w.getRow()!.refresh_token_encrypted, 'enc(refresh-2)');
  await markNeedsReconnectCore(w.deps, 't1', 'a1', null);
  assert.equal(w.getRow()!.status, 'needs_reconnect');
});

test('H-02: reconnection waits for an in-flight refresh holding the same lock', async () => {
  const w = fakeWorld({ start: { session_id: 'A' } });
  const order: string[] = [];
  const orig = w.deps.postForm;
  w.deps.postForm = async (url, form) => { order.push('refresh:start'); const r = await orig(url, form); order.push('refresh:end'); return r; };
  const refresh = getValidAccessTokenCore(w.deps, tokenInput);
  await new Promise((r) => setTimeout(r, 5)); // refresh holds the lock now
  const reconnect = withRefreshLockCore(w.deps, 't1', async () => { order.push('reconnect'); w.setRow(sessionB()); });
  await Promise.all([refresh, reconnect]);
  assert.deepEqual(order, ['refresh:start', 'refresh:end', 'reconnect']);
  assert.equal(w.getRow()!.session_id, 'B');
  assert.equal(w.kv.size, 0);
});

test('H-02: reconnection lock wait is bounded (generic transient error, fn not run)', async () => {
  const w = fakeWorld();
  w.kv.set(REFRESH_LOCK_PREFIX + 't1', 'someone-else');
  let ran = false;
  await assert.rejects(() => withRefreshLockCore(w.deps, 't1', async () => { ran = true; }), McpOAuthTransientError);
  assert.equal(ran, false);
  assert.equal(w.kv.get(REFRESH_LOCK_PREFIX + 't1'), 'someone-else', 'foreign lock not released');
});

test('H-06: unreadable 2xx refresh → needs_reconnect (no blind replay later); network error stays transient', async () => {
  const w = fakeWorld({ tokenResponses: [{ status: 200, body: null }] });
  await assert.rejects(() => getValidAccessTokenCore(w.deps, tokenInput), McpOAuthReconnectRequiredError);
  assert.equal(w.getRow()!.status, 'needs_reconnect');
  await assert.rejects(() => getValidAccessTokenCore(w.deps, tokenInput), McpOAuthReconnectRequiredError);
  assert.equal(w.tokenCalls.length, 1, 'the consumed refresh token is never sent again');

  const w2 = fakeWorld({ tokenResponses: [{ status: 200, body: { access_token: 'x' } }] }); // no refresh_token
  await assert.rejects(() => getValidAccessTokenCore(w2.deps, tokenInput), McpOAuthReconnectRequiredError);

  const w3 = fakeWorld({ tokenResponses: [new Error('ETIMEDOUT')] });
  await assert.rejects(() => getValidAccessTokenCore(w3.deps, tokenInput), McpOAuthTransientError);
  assert.equal(w3.getRow()!.status, 'connected');
});

test('H-02: execute wrapper marks the session of the token actually used', async () => {
  const marked: Array<string | null> = [];
  const r = await executeWithOAuthCore(
    {
      execute: async (h) => (h['Authorization'] === 'Bearer stale'
        ? { content: 'HTTP 401', isError: true }
        : { content: 'sesión MCP no válida (token has been revoked)', isError: true }),
      getToken: async () => ({ accessToken: 'fresh', sessionId: 'B' }),
      markNeedsReconnect: async (sid) => { marked.push(sid); },
      providerName: 'Dropi',
      log: { info: () => {}, warn: () => {}, error: () => {} },
    },
    { Authorization: 'Bearer stale' },
    'A'
  );
  assert.equal(r.content, oauthUnavailableMessage('Dropi'));
  assert.deepEqual(marked, ['B']);
});

// ── Prompt 05: revoke on reconnection only when the account changed ──────────

const b64u = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (payload: unknown) => `${b64u({ alg: 'RS256', typ: 'JWT' })}.${b64u(payload)}.signature`;

test('jwtSubject: valid JWT → sub; malformed or without sub → null (never throws)', () => {
  assert.equal(jwtSubject(jwt({ sub: '12345', user_name: 'x', country_code: 'CO', white_brand_id: 1 })), '12345');
  for (const bad of ['', 'not-a-jwt', 'a.b', 'a.%%%.c', `${b64u({})}.${Buffer.from('not json').toString('base64url')}.s`, 'a.b.c.d']) {
    assert.equal(jwtSubject(bad), null, bad);
  }
  assert.equal(jwtSubject(jwt({ user_name: 'x' })), null);
  assert.equal(jwtSubject(jwt({ sub: '' })), null);
  assert.equal(jwtSubject(jwt({ sub: 42 })), null);
  assert.equal(jwtSubject(jwt(null)), null);
  assert.equal(jwtSubject(undefined as unknown as string), null);
});

function revokeWorld() {
  let revoked = 0;
  const logs: string[] = [];
  return {
    revoked: () => revoked,
    logs,
    deps: {
      decrypt: (t: string) => t.slice(4, -1),
      revoke: async () => { revoked += 1; },
      log: { info: (m: string) => logs.push(m), warn: (m: string) => logs.push(m), error: (m: string) => logs.push(m) },
    },
  };
}
const prevWith = (token: string) => ({ access_token_encrypted: `enc(${token})`, refresh_token_encrypted: 'enc(r)' });

test('reconnection with the same account (same sub) → no revocation, generic log only', async () => {
  const w = revokeWorld();
  await revokePreviousIfAccountChangedCore(w.deps, prevWith(jwt({ sub: 'acc-1', n: 1 })), jwt({ sub: 'acc-1', n: 2 }));
  assert.equal(w.revoked(), 0);
  assert.deepEqual(w.logs, ['[mcp-oauth] Previous session not revoked (same account or unknown)']);
  assert.equal(w.logs.join(' ').includes('acc-1'), false);
});

test('reconnection with a different account → revoked exactly once', async () => {
  const w = revokeWorld();
  await revokePreviousIfAccountChangedCore(w.deps, prevWith(jwt({ sub: 'acc-1' })), jwt({ sub: 'acc-2' }));
  assert.equal(w.revoked(), 1);
});

test('reconnection with an unreadable sub (either side) → no revocation', async () => {
  for (const [prev, next] of [
    ['opaque-token', jwt({ sub: 'acc-2' })],
    [jwt({ sub: 'acc-1' }), 'opaque-token'],
    [jwt({ user_name: 'x' }), jwt({ sub: 'acc-2' })],
  ] as const) {
    const w = revokeWorld();
    await revokePreviousIfAccountChangedCore(w.deps, prevWith(prev), next);
    assert.equal(w.revoked(), 0);
  }
  const w = revokeWorld();
  w.deps.decrypt = () => { throw new Error('bad ciphertext'); };
  await revokePreviousIfAccountChangedCore(w.deps, prevWith(jwt({ sub: 'acc-1' })), jwt({ sub: 'acc-2' }));
  assert.equal(w.revoked(), 0);
});

// ── Refresh: one retry when the token endpoint moved (prompt 19) ────────────

const NEW_TOKEN_ENDPOINT = 'https://mcp.dropi.co/oauth/token';

function capturingLogs(w: ReturnType<typeof fakeWorld>): string[] {
  const logs: string[] = [];
  w.deps.log = { info: (m) => logs.push(m), warn: (m) => logs.push(m), error: (m) => logs.push(m) };
  return logs;
}

function rediscoverInput(result: string | null | Error) {
  let calls = 0;
  return {
    get calls() { return calls; },
    input: {
      ...tokenInput,
      rediscoverTokenEndpoint: async () => {
        calls += 1;
        if (result instanceof Error) throw result;
        return result;
      },
    },
  };
}

const SECRET_VALUES = ['refresh-1', 'refresh-2', 'access-1', 'access-old'];
function assertNoSecrets(logs: string[]) {
  for (const line of logs) for (const s of SECRET_VALUES) assert.ok(!line.includes(s), `log leaks ${s}: ${line}`);
}

test('refresh retry: 400 invalid_request at the old endpoint + another discovered endpoint → ONE retry that stores the tokens', async () => {
  const w = fakeWorld({ tokenResponses: [{ status: 400, body: { error: 'invalid_request' } }] });
  const logs = capturingLogs(w);
  const r = rediscoverInput(NEW_TOKEN_ENDPOINT);
  assert.equal(await getValidAccessTokenCore(w.deps, r.input), 'access-1');
  assert.equal(r.calls, 1);
  assert.deepEqual(w.tokenCalls.map((c) => c.url), [ENDPOINTS.tokenEndpoint, NEW_TOKEN_ENDPOINT]);
  assert.equal(w.tokenCalls[1]!.form['refresh_token'], 'refresh-1', 'same refresh token: the old endpoint did not accept it');
  assert.equal(w.tokenCalls[1]!.form['resource'], ENDPOINTS.resource);
  assert.equal(w.getRow()!.status, 'connected');
  assert.equal(w.getRow()!.refresh_token_encrypted, 'enc(refresh-2)');
  assert.ok(logs.some((l) => l.includes(`retrying once at discovered ${NEW_TOKEN_ENDPOINT}`) && l.includes('tool t1')));
  assert.equal(w.kv.has(REFRESH_LOCK_PREFIX + 't1'), false, 'lock released');
  assertNoSecrets(logs);
});

test('refresh retry: 400 with a non-JSON body and 404 also trigger the single retry', async () => {
  for (const first of [{ status: 400, body: null }, { status: 401, body: { error: 'invalid_client' } }, { status: 404, body: null }]) {
    const w = fakeWorld({ tokenResponses: [first] });
    const r = rediscoverInput(NEW_TOKEN_ENDPOINT);
    assert.equal(await getValidAccessTokenCore(w.deps, r.input), 'access-1', JSON.stringify(first));
    assert.equal(w.tokenCalls.length, 2);
  }
});

test('refresh retry: invalid_grant → no re-discovery, no retry, reconnect', async () => {
  const w = fakeWorld({ tokenResponses: [{ status: 400, body: { error: 'invalid_grant' } }] });
  const r = rediscoverInput(NEW_TOKEN_ENDPOINT);
  await assert.rejects(getValidAccessTokenCore(w.deps, r.input), McpOAuthReconnectRequiredError);
  assert.equal(r.calls, 0);
  assert.equal(w.tokenCalls.length, 1);
  assert.equal(w.getRow()!.status, 'needs_reconnect');
});

test('refresh retry: same endpoint discovered (or none) → no retry, reconnect', async () => {
  for (const discovered of [ENDPOINTS.tokenEndpoint, null, new Error('discovery down')]) {
    const w = fakeWorld({ tokenResponses: [{ status: 400, body: { error: 'invalid_request' } }] });
    const r = rediscoverInput(discovered);
    await assert.rejects(getValidAccessTokenCore(w.deps, r.input), McpOAuthReconnectRequiredError);
    assert.equal(r.calls, 1);
    assert.equal(w.tokenCalls.length, 1);
    assert.equal(w.getRow()!.status, 'needs_reconnect');
  }
});

test('refresh retry: the retry also fails (400) → reconnect, exactly two calls', async () => {
  const w = fakeWorld({ tokenResponses: [{ status: 400, body: { error: 'invalid_request' } }, { status: 400, body: { error: 'invalid_request' } }] });
  const logs = capturingLogs(w);
  const r = rediscoverInput(NEW_TOKEN_ENDPOINT);
  await assert.rejects(getValidAccessTokenCore(w.deps, r.input), McpOAuthReconnectRequiredError);
  assert.equal(r.calls, 1);
  assert.equal(w.tokenCalls.length, 2);
  assert.equal(w.getRow()!.status, 'needs_reconnect');
  assertNoSecrets(logs);
});

test('refresh retry: network error on the first call → transient, no re-discovery, tokens untouched', async () => {
  const w = fakeWorld({ tokenResponses: [new Error('ECONNRESET')] });
  const r = rediscoverInput(NEW_TOKEN_ENDPOINT);
  await assert.rejects(getValidAccessTokenCore(w.deps, r.input), McpOAuthTransientError);
  assert.equal(r.calls, 0);
  assert.equal(w.getRow()!.status, 'connected');
  assert.equal(w.getRow()!.refresh_token_encrypted, 'enc(refresh-1)');
});

test('refresh retry: network error on the retry → transient, tokens untouched', async () => {
  const w = fakeWorld({ tokenResponses: [{ status: 404, body: null }, new Error('ETIMEDOUT')] });
  const r = rediscoverInput(NEW_TOKEN_ENDPOINT);
  await assert.rejects(getValidAccessTokenCore(w.deps, r.input), McpOAuthTransientError);
  assert.equal(w.tokenCalls.length, 2);
  assert.equal(w.getRow()!.status, 'connected');
});

test('refresh retry: 404 with the endpoint unchanged keeps the current behaviour (transient, tokens untouched)', async () => {
  const w = fakeWorld({ tokenResponses: [{ status: 404, body: null }] });
  const r = rediscoverInput(ENDPOINTS.tokenEndpoint);
  await assert.rejects(getValidAccessTokenCore(w.deps, r.input), McpOAuthTransientError);
  assert.equal(w.getRow()!.status, 'connected');
});

test('refresh retry: 5xx is not a moved-endpoint signal (no re-discovery)', async () => {
  const w = fakeWorld({ tokenResponses: [{ status: 503, body: null }] });
  const r = rediscoverInput(NEW_TOKEN_ENDPOINT);
  await assert.rejects(getValidAccessTokenCore(w.deps, r.input), McpOAuthTransientError);
  assert.equal(r.calls, 0);
});

test('refresh retry happens inside the lock (re-discovery and retry run while it is held)', async () => {
  const w = fakeWorld({ tokenResponses: [{ status: 400, body: { error: 'invalid_request' } }] });
  let heldDuringRediscovery = false;
  let heldDuringRetry = false;
  const origPost = w.deps.postForm;
  w.deps.postForm = async (url, form) => {
    if (url === NEW_TOKEN_ENDPOINT) heldDuringRetry = w.kv.has(REFRESH_LOCK_PREFIX + 't1');
    return origPost(url, form);
  };
  await getValidAccessTokenCore(w.deps, {
    ...tokenInput,
    rediscoverTokenEndpoint: async () => { heldDuringRediscovery = w.kv.has(REFRESH_LOCK_PREFIX + 't1'); return NEW_TOKEN_ENDPOINT; },
  });
  assert.equal(heldDuringRediscovery, true);
  assert.equal(heldDuringRetry, true);
});

test('lock TTL covers refresh + re-discovery (2 x 5 s); the retry is covered by the extension', () => {
  assert.ok(REFRESH_LOCK_TTL_MS > 15_000 + 2 * 5_000);
  assert.ok(RETRY_LOCK_EXTEND_MS >= 30_000 && RETRY_LOCK_EXTEND_MS > 15_000);
  assert.ok(LOCK_EXTEND_TIMEOUT_MS <= 2_000);
});

// ── D-01: the retry only runs with the lock confirmed ours (prompt 21) ─────

test('D-01: lock extended (still ours) → the retry happens, extension requested for >= 30 s', async () => {
  const w = fakeWorld({ tokenResponses: [{ status: 404, body: null }] });
  const r = rediscoverInput(NEW_TOKEN_ENDPOINT);
  assert.equal(await getValidAccessTokenCore(w.deps, r.input), 'access-1');
  assert.deepEqual(w.extendCalls, [{ key: REFRESH_LOCK_PREFIX + 't1', ms: RETRY_LOCK_EXTEND_MS }]);
  assert.equal(w.tokenCalls.length, 2);
});

test('D-01: lock lost (another process holds it now) → NO retry, current behaviour, warn log', async () => {
  for (const [first, expected] of [
    [{ status: 404, body: null }, McpOAuthTransientError],
    [{ status: 400, body: { error: 'invalid_request' } }, McpOAuthReconnectRequiredError],
  ] as const) {
    const w = fakeWorld({ tokenResponses: [first] });
    const logs = capturingLogs(w);
    await assert.rejects(
      getValidAccessTokenCore(w.deps, {
        ...tokenInput,
        rediscoverTokenEndpoint: async () => {
          w.kv.set(REFRESH_LOCK_PREFIX + 't1', 'someone-else'); // our lock expired and was taken
          return NEW_TOKEN_ENDPOINT;
        },
      }),
      expected
    );
    assert.equal(w.tokenCalls.length, 1, 'the refresh token is never sent twice');
    assert.ok(logs.some((l) => l.includes('refresh lock could not be confirmed') && l.includes('skipped')));
    assert.equal(w.kv.get(REFRESH_LOCK_PREFIX + 't1'), 'someone-else', 'the other holder keeps its lock');
    assertNoSecrets(logs);
  }
});

test('D-01: Redis extension fails or does not answer in time → NO retry', async () => {
  for (const extend of [
    async () => { throw new Error('redis down'); },
    () => new Promise<boolean>(() => { /* never answers */ }),
  ]) {
    const w = fakeWorld({ tokenResponses: [{ status: 404, body: null }] });
    w.deps.kv.extendIfEquals = extend;
    const r = rediscoverInput(NEW_TOKEN_ENDPOINT);
    const t0 = Date.now();
    await assert.rejects(getValidAccessTokenCore(w.deps, r.input), McpOAuthTransientError);
    assert.ok(Date.now() - t0 < LOCK_EXTEND_TIMEOUT_MS + 1_000, 'bounded wait');
    assert.equal(w.tokenCalls.length, 1);
    assert.equal(w.getRow()!.refresh_token_encrypted, 'enc(refresh-1)', 'tokens untouched');
  }
});

test('D-01: no extension is attempted when there is nothing to retry', async () => {
  const w = fakeWorld({ tokenResponses: [{ status: 404, body: null }] });
  const r = rediscoverInput(ENDPOINTS.tokenEndpoint);
  await assert.rejects(getValidAccessTokenCore(w.deps, r.input), McpOAuthTransientError);
  assert.equal(w.extendCalls.length, 0);
});

// ── D-07: persistent 404 alert ───────────────────────────────────────────────

test('D-07: 404 with the endpoint unchanged → transient + ONE ALERT per provider per 24 h', async () => {
  const w = fakeWorld({ tokenResponses: [{ status: 404, body: null }, { status: 404, body: null }] });
  const logs = capturingLogs(w);
  const input = { ...rediscoverInput(ENDPOINTS.tokenEndpoint).input, providerId: 'dropi' };
  await assert.rejects(getValidAccessTokenCore(w.deps, input), McpOAuthTransientError);
  await assert.rejects(getValidAccessTokenCore(w.deps, input), McpOAuthTransientError);
  const alerts = logs.filter((l) => l.includes('ALERT token endpoint returned 404'));
  assert.deepEqual(alerts, ['[mcp-oauth] ALERT token endpoint returned 404 for provider dropi; tools may stay disconnected']);
  assert.ok(w.kv.has(TOKEN_404_ALERT_PREFIX + 'dropi'));
  assert.equal(TOKEN_404_ALERT_TTL_MS, 24 * 60 * 60 * 1000);
  assert.equal(w.getRow()!.status, 'connected');
});

test('D-07: a 404 that was retried successfully elsewhere does not alert', async () => {
  const w = fakeWorld({ tokenResponses: [{ status: 404, body: null }] });
  const logs = capturingLogs(w);
  await getValidAccessTokenCore(w.deps, { ...rediscoverInput(NEW_TOKEN_ENDPOINT).input, providerId: 'dropi' });
  assert.equal(logs.filter((l) => l.includes('ALERT token endpoint returned 404')).length, 0);
});

// ── D-11 / D-12 ──────────────────────────────────────────────────────────────

test('D-11: no alternative endpoint → neutral log (no "re-discovery" wording)', async () => {
  const w = fakeWorld({ tokenResponses: [{ status: 400, body: { error: 'invalid_request' } }] });
  const logs = capturingLogs(w);
  await assert.rejects(getValidAccessTokenCore(w.deps, rediscoverInput(null).input), McpOAuthReconnectRequiredError);
  assert.ok(logs.some((l) => l.includes('no other token endpoint available, no retry')));
  assert.ok(logs.every((l) => !/re-?discovery/i.test(l)));
});

test('D-12: a discovered endpoint that only differs in normalization from the current one → no retry', async () => {
  const w = fakeWorld({ tokenResponses: [{ status: 404, body: null }] });
  const input = {
    ...tokenInput,
    getEndpoints: async () => ({ ...ENDPOINTS, tokenEndpoint: 'https://T.EXAMPLE:443/token' }),
    rediscoverTokenEndpoint: async () => 'https://t.example/token',
  };
  await assert.rejects(getValidAccessTokenCore(w.deps, input), McpOAuthTransientError);
  assert.equal(w.tokenCalls.length, 1, 'same endpoint: the token is not resent');
});

// ── D-09: error codes in logs ────────────────────────────────────────────────

test('D-09: oauthErrorCode keeps only [a-z0-9_.-]{1,64}; anything else → unknown', () => {
  assert.equal(oauthErrorCode({ error: 'invalid_grant' }), 'invalid_grant');
  assert.equal(oauthErrorCode({ error: 'server.error-1' }), 'server.error-1');
  assert.equal(oauthErrorCode({ error: 'x\n[mcp-oauth] Refreshed access token for tool t1' }), 'unknown');
  assert.equal(oauthErrorCode({ error: 'bad\r\ncode' }), 'unknown');
  assert.equal(oauthErrorCode({ error: 'INVALID_GRANT' }), 'unknown');
  assert.equal(oauthErrorCode({ error: 'a'.repeat(65) }), 'unknown');
  assert.equal(oauthErrorCode({ error: '' }), 'unknown');
  assert.equal(oauthErrorCode({ error: 42 }), 'unknown');
  assert.equal(oauthErrorCode(null), 'unknown');
});

test('D-09: a CRLF error code never reaches the refresh logs', async () => {
  const w = fakeWorld({ tokenResponses: [{ status: 400, body: { error: 'evil\n[mcp-oauth] fake line' } }] });
  const logs = capturingLogs(w);
  await assert.rejects(getValidAccessTokenCore(w.deps, tokenInput), McpOAuthReconnectRequiredError);
  assert.ok(logs.every((l) => !l.includes('\n') && !l.includes('fake line')));
  assert.ok(logs.some((l) => l.includes('error=unknown')));
});

// ── D-08: an oversized (unreadable) token body ───────────────────────────────

test('D-08: oversized 2xx body (postForm → body null): refresh → reconnect, exchange → failed', async () => {
  const w = fakeWorld({ tokenResponses: [{ status: 200, body: null }] });
  await assert.rejects(getValidAccessTokenCore(w.deps, tokenInput), McpOAuthReconnectRequiredError);
  assert.equal(w.getRow()!.status, 'needs_reconnect', 'never a blind replay of a possibly rotated token');
  assert.equal(w.tokenCalls.length, 1);
  const x = fakeWorld({ tokenResponses: [{ status: 200, body: null }] });
  await assert.rejects(
    exchangeAuthorizationCode(x.deps, { endpoints: ENDPOINTS, code: 'c', redirectUri: 'https://app/cb', codeVerifier: 'v' }),
    McpOAuthExchangeError
  );
});
