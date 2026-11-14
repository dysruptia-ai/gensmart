/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers tests at import */
/**
 * Integration test against a real Postgres (opt-in: MCP_OAUTH_DB_TEST=1, e.g. docker compose up -d).
 * Skipped otherwise, so CI without a database is unaffected.
 *
 * Verifies the invariant behind the rotating refresh token: an agentService.updateTool carrying a
 * STALE `oauth` block must never overwrite the one the OAuth service stored (rotated) meanwhile.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { query } from '../config/database';
import { updateTool } from './agent.service';

const enabled = process.env['MCP_OAUTH_DB_TEST'] === '1';

test('updateTool keeps the rotated oauth block even when given a stale one', { skip: !enabled }, async () => {
  const org = await query<{ id: string }>(
    `INSERT INTO organizations (name, slug) VALUES ('oauth-db-test', 'oauth-db-test-' || gen_random_uuid()) RETURNING id`
  );
  const orgId = org.rows[0]!.id;
  try {
    const agent = await query<{ id: string }>(
      `INSERT INTO agents (organization_id, name, system_prompt, llm_provider, llm_model)
       VALUES ($1, 'a', 'p', 'openai', 'gpt-4o-mini') RETURNING id`,
      [orgId]
    );
    const agentId = agent.rows[0]!.id;
    const stale = { access_token_encrypted: 'A1', refresh_token_encrypted: 'R1', status: 'connected' };
    const tool = await query<{ id: string }>(
      `INSERT INTO agent_tools (agent_id, type, name, config) VALUES ($1, 'mcp', 't', $2::jsonb) RETURNING id`,
      [agentId, JSON.stringify({ server_url: 'https://mcp.example/mcp', oauth: stale })]
    );
    const toolId = tool.rows[0]!.id;

    // The worker rotates the token (same SQL shape as mergeOAuth in mcp-oauth.service.ts)
    const rotated = { access_token_encrypted: 'A2', refresh_token_encrypted: 'R2' };
    await query(
      `UPDATE agent_tools SET config = jsonb_set(config, '{oauth}', COALESCE(config->'oauth','{}'::jsonb) || $2::jsonb, true) WHERE id = $1`,
      [toolId, JSON.stringify(rotated)]
    );

    // A config save built from the earlier (stale) read, carrying the old oauth
    await updateTool(orgId, agentId, toolId, {
      config: { server_url: 'https://mcp.example/mcp', name: 'renamed', oauth: stale },
    });

    const after = await query<{ config: { name?: string; oauth?: Record<string, string> } }>(
      'SELECT config FROM agent_tools WHERE id = $1', [toolId]
    );
    assert.equal(after.rows[0]!.config.name, 'renamed', 'the rest of the config is updated');
    assert.equal(after.rows[0]!.config.oauth?.['refresh_token_encrypted'], 'R2', 'rotated refresh token preserved');
    assert.equal(after.rows[0]!.config.oauth?.['access_token_encrypted'], 'A2');

    // A tool without oauth: an injected oauth key is ignored, not stored
    const plain = await query<{ id: string }>(
      `INSERT INTO agent_tools (agent_id, type, name, config) VALUES ($1, 'mcp', 'p', '{"server_url":"u"}'::jsonb) RETURNING id`,
      [agentId]
    );
    await updateTool(orgId, agentId, plain.rows[0]!.id, { config: { server_url: 'u2', oauth: stale } });
    const p2 = await query<{ config: Record<string, unknown> }>('SELECT config FROM agent_tools WHERE id = $1', [plain.rows[0]!.id]);
    assert.equal('oauth' in p2.rows[0]!.config, false);
    assert.equal(p2.rows[0]!.config['server_url'], 'u2');
  } finally {
    await query('DELETE FROM agent_tools WHERE agent_id IN (SELECT id FROM agents WHERE organization_id = $1)', [orgId]);
    await query('DELETE FROM agents WHERE organization_id = $1', [orgId]);
    await query('DELETE FROM organizations WHERE id = $1', [orgId]);
  }
});
