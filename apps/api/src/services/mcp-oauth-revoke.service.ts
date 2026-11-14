/**
 * Best-effort revocation of MCP OAuth sessions (RFC 7009) at the provider's revocation_endpoint.
 *
 * Kept apart from mcp-oauth.service.ts so agent.service.ts (deleteTool) can use it without a
 * circular import. NEVER throws and never blocks longer than REVOKE_TIMEOUT_MS: a failed
 * revocation must not make a reconnection or a deletion fail. Logs never include tokens.
 */

import { query } from '../config/database';
import { decrypt } from '../config/encryption';
import { safeUndiciFetch } from './safe-url';
import * as mcpProviders from './mcp-providers.service';
import type { StoredOAuth } from './mcp-oauth.core';

const REVOKE_TIMEOUT_MS = 10_000;

export async function revokeOAuthSession(
  stored: Partial<StoredOAuth> | null | undefined,
  profile: mcpProviders.MCPProviderProfile | null | undefined
): Promise<void> {
  try {
    const endpoint = profile?.oauth_config?.revocation_endpoint;
    if (!profile || !endpoint || !stored?.refresh_token_encrypted) return;

    const clientId = await mcpProviders.resolveValueRef(profile.oauth_config!.client_id_ref, `profile ${profile.id}, oauth client_id`);
    if (!clientId) {
      console.warn(`[mcp-oauth] Revocation skipped for provider ${profile.id}: client_id not configured`);
      return;
    }

    const form = new URLSearchParams({
      token: decrypt(stored.refresh_token_encrypted),
      token_type_hint: 'refresh_token',
      client_id: clientId,
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REVOKE_TIMEOUT_MS);
    try {
      const res = await safeUndiciFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: form.toString(),
        signal: controller.signal,
      });
      await res.text().catch(() => '');
      if (res.status >= 200 && res.status < 300) {
        console.log(`[mcp-oauth] Previous session revoked at provider ${profile.id}`);
      } else {
        console.warn(`[mcp-oauth] Revocation at provider ${profile.id} answered HTTP ${res.status}`);
      }
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    console.warn(`[mcp-oauth] Revocation failed for provider ${profile?.id ?? 'unknown'}: ${(err as Error).message}`);
  }
}

/**
 * Before deleting a tool: revokes its OAuth session if it is an MCP tool with an `oauth` block.
 * The caller MUST have verified that `agentId` belongs to the requesting organization.
 */
export async function revokeToolOAuthBeforeDelete(toolId: string, agentId: string): Promise<void> {
  try {
    const r = await query<{ type: string; oauth: Partial<StoredOAuth> | null; provider_id: string | null }>(
      `SELECT type, config->'oauth' AS oauth, config->>'providerId' AS provider_id
         FROM agent_tools WHERE id = $1 AND agent_id = $2`,
      [toolId, agentId]
    );
    const row = r.rows[0];
    if (!row || row.type !== 'mcp' || !row.oauth || !row.provider_id) return;
    const profile = await mcpProviders.findProfileById(row.provider_id);
    await revokeOAuthSession(row.oauth, profile);
  } catch (err) {
    console.warn(`[mcp-oauth] Could not prepare revocation for tool ${toolId}: ${(err as Error).message}`);
  }
}
