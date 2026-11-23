/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers tests at import */
/**
 * buildMcpToolHeaders with fake dependencies (no DB/Redis calls). Verifies H-05: OAuth providers
 * without webhook events receive no GenSmart system headers, and that every other provider
 * (Mastershop, Venndelo, WooCommerce, Tiendanube…) keeps exactly the previous headers.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMcpToolHeaders, type BuildHeadersDeps } from './mcp-oauth.service';
import type { MCPProviderProfile } from './mcp-providers.service';

const base: MCPProviderProfile = {
  id: 'p', name: 'P', match_url_pattern: 'mcp.example.com', match_strategy: 'domain_exact',
  default_transport: 'streamable-http', default_server_url: 'https://mcp.example.com/mcp',
  auto_injected_headers: [], user_configurable_headers: [], supported_events: [],
  requires_oauth_connect: false, health_check_tool: null, is_active: true,
  oauth_config: null, allowed_org_ids: null, default_selected_tools: null,
};

function deps(profile: MCPProviderProfile): BuildHeadersDeps & { tokenCalls: number } {
  const d = {
    tokenCalls: 0,
    findProfileById: async () => profile,
    resolveAutoHeaders: async () => ({ 'X-Master-Key': 'master' }),
    decryptHeaders: () => ({ 'X-User': 'user' }),
    decrypt: (t: string) => `dec(${t})`,
    getToken: async () => { d.tokenCalls += 1; return { accessToken: 'AT', sessionId: 'S1' }; },
  };
  return d;
}

const input = {
  logPrefix: '[test]', toolId: 't1', agentId: 'agent-1', sessionId: 'conv-1', serverUrl: 'https://mcp.example.com/mcp',
  cfg: { providerId: 'p', webhookSecret_encrypted: 'WS', oauth: { status: 'connected' as const } },
};

test('H-05: OAuth profile without events → only Authorization plus profile/user headers', async () => {
  const profile = { ...base, oauth_config: { authorization_endpoint: 'a', token_endpoint: 't', client_id_ref: 'fixed:c', scope: 'mcp' } };
  const d = deps(profile);
  const built = await buildMcpToolHeaders(input, d);
  assert.deepEqual(built.headers, { 'X-Master-Key': 'master', 'X-User': 'user', Authorization: 'Bearer AT' });
  assert.equal(built.oauth?.sessionId, 'S1');
  assert.equal(d.tokenCalls, 1);
});

test('H-05: profile WITHOUT OAuth → identical headers to before (system headers included)', async () => {
  const built = await buildMcpToolHeaders(input, deps({ ...base, supported_events: ['order.created'] }));
  assert.deepEqual(built.headers, {
    'X-Master-Key': 'master', 'X-User': 'user',
    'X-Agent-ID': 'agent-1', 'X-Session-ID': 'conv-1', 'X-Webhook-Secret': 'dec(WS)',
  });
  assert.equal(built.oauth, null);
  // Without events either (e.g. a header-auth provider): unchanged too.
  const built2 = await buildMcpToolHeaders(input, deps(base));
  assert.equal(built2.headers['X-Webhook-Secret'], 'dec(WS)');
  assert.equal(built2.headers['X-Agent-ID'], 'agent-1');
});

test('H-05: OAuth profile WITH events keeps the system headers', async () => {
  const profile = { ...base, supported_events: ['x'], oauth_config: { authorization_endpoint: 'a', token_endpoint: 't', client_id_ref: 'fixed:c', scope: 'mcp' } };
  const built = await buildMcpToolHeaders(input, deps(profile));
  assert.equal(built.headers['X-Webhook-Secret'], 'dec(WS)');
  assert.equal(built.headers['Authorization'], 'Bearer AT');
});

test('Bearer is never sent to a server_url that does not match the profile', async () => {
  const profile = { ...base, oauth_config: { authorization_endpoint: 'a', token_endpoint: 't', client_id_ref: 'fixed:c', scope: 'mcp' } };
  const d = deps(profile);
  const built = await buildMcpToolHeaders({ ...input, serverUrl: 'https://attacker.example/mcp' }, d);
  assert.equal('Authorization' in built.headers, false);
  assert.equal(d.tokenCalls, 0);
});
