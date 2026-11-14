/**
 * MCP OAuth service — real wiring (Redis, Postgres, safeUndiciFetch, encryption)
 * around the pure core in mcp-oauth.core.ts. Generic: not Dropi-specific; any
 * provider profile with `oauth_config` works.
 *
 * Tokens live in `agent_tools.config.oauth` (encrypted). They never leave the API:
 * agent.service.ts strips `config.oauth` and exposes only `oauth_status`.
 */

import { randomUUID, randomBytes } from 'crypto';
import { query } from '../config/database';
import { redis } from '../config/redis';
import { encrypt, decrypt } from '../config/encryption';
import { safeUndiciFetch } from './safe-url';
import * as mcpProviders from './mcp-providers.service';
import * as agentService from './agent.service';
import { connectAndListTools, executeMCPTool, type MCPToolResult } from './mcp-client.service';
import { decryptHeaders, type EncryptedHeader } from './mcp-headers.service';
import { serverUrlMatchesProfile } from './mcp-provider-url';
import {
  startAuthorizationCore,
  consumeState,
  peekState,
  createTicket,
  claimTicket,
  exchangeAuthorizationCode,
  buildStoredOAuth,
  getValidAccessTokenCore,
  markNeedsReconnectCore,
  executeWithOAuthCore,
  McpOAuthReconnectRequiredError,
  McpOAuthStateError,
  McpOAuthExchangeError,
  McpOAuthForbiddenError,
  type OAuthStatePayload,
  type OAuthDeps,
  type OAuthEndpoints,
  type StoredOAuth,
  type HttpPostResult,
} from './mcp-oauth.core';
import { AppError } from '../middleware/errorHandler';

export {
  McpOAuthReconnectRequiredError,
  McpOAuthStateError,
  McpOAuthExchangeError,
  McpOAuthTransientError,
  isRevokedToolResult,
  McpOAuthForbiddenError,
  oauthUnavailableMessage,
} from './mcp-oauth.core';

const HTTP_TIMEOUT_MS = 15_000;

// ── Real dependencies ────────────────────────────────────────────────────────

const RELEASE_LOCK_LUA = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;

async function postForm(url: string, form: Record<string, string>): Promise<HttpPostResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
  try {
    const res = await safeUndiciFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams(form).toString(),
      signal: controller.signal,
    });
    const text = await res.text().catch(() => '');
    let body: unknown = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = null; }
    return { status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

async function loadOAuth(toolId: string, agentId: string): Promise<StoredOAuth | null> {
  const r = await query<{ oauth: StoredOAuth | null }>(
    `SELECT config->'oauth' AS oauth FROM agent_tools WHERE id = $1 AND agent_id = $2`,
    [toolId, agentId]
  );
  return r.rows[0]?.oauth ?? null;
}

/**
 * Replaces the WHOLE `config.oauth` block (no merge: nothing of a previous session survives).
 * Only the OAuth service writes config.oauth; agentService.updateTool preserves it.
 */
async function replaceOAuth(toolId: string, agentId: string, oauth: StoredOAuth): Promise<void> {
  await query(
    `UPDATE agent_tools SET config = jsonb_set(config, '{oauth}', $3::jsonb, true), is_enabled = true, updated_at = NOW()
      WHERE id = $1 AND agent_id = $2`,
    [toolId, agentId, JSON.stringify(oauth)]
  );
}

async function mergeOAuth(toolId: string, agentId: string, patch: Partial<StoredOAuth>): Promise<void> {
  // Merge only config.oauth in one UPDATE: concurrent edits to other config keys are not overwritten.
  await query(
    `UPDATE agent_tools
        SET config = jsonb_set(config, '{oauth}', COALESCE(config->'oauth', '{}'::jsonb) || $3::jsonb, true),
            updated_at = NOW()
      WHERE id = $1 AND agent_id = $2`,
    [toolId, agentId, JSON.stringify(patch)]
  );
}

const realDeps: OAuthDeps = {
  kv: {
    setEx: async (key, value, seconds) => {
      try {
        await redis.set(key, value, 'EX', seconds);
      } catch {
        throw new AppError(503, 'Could not start the connection session. Try again.', 'CONNECT_SESSION_UNAVAILABLE');
      }
    },
    get: (key) => redis.get(key),
    getDel: (key) => redis.getdel(key),
    setNxPx: async (key, value, ms) => (await redis.set(key, value, 'PX', ms, 'NX')) === 'OK',
    delIfEquals: async (key, value) => {
      await redis.eval(RELEASE_LOCK_LUA, 1, key, value);
    },
  },
  loadOAuth,
  mergeOAuth,
  postForm,
  encrypt,
  decrypt,
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  randomBytes: (n) => randomBytes(n),
  randomUUID: () => randomUUID(),
  log: {
    info: (m) => console.log(m),
    warn: (m) => console.warn(m),
    error: (m) => console.error(m),
  },
};

// ── Profile helpers ──────────────────────────────────────────────────────────

async function resolveClientId(profile: mcpProviders.MCPProviderProfile): Promise<string> {
  const cfg = profile.oauth_config;
  if (!cfg) throw new AppError(400, 'Provider does not use OAuth', 'OAUTH_NOT_SUPPORTED');
  // Same value_ref resolution as auto_injected_headers (platform_setting: / fixed:).
  const clientId = await mcpProviders.resolveValueRef(cfg.client_id_ref, `profile ${profile.id}, oauth client_id`);
  if (!clientId) {
    throw new AppError(500, 'OAuth client_id is not configured for this provider', 'OAUTH_CLIENT_ID_MISSING');
  }
  return clientId;
}

async function endpointsFor(profile: mcpProviders.MCPProviderProfile): Promise<OAuthEndpoints> {
  const cfg = profile.oauth_config;
  if (!cfg) throw new AppError(400, 'Provider does not use OAuth', 'OAUTH_NOT_SUPPORTED');
  return { tokenEndpoint: cfg.token_endpoint, clientId: await resolveClientId(profile), resource: cfg.resource };
}

/** Profile usable for OAuth start: exists, active, has oauth_config, visible to the org. Otherwise null. */
export async function findOAuthProfileForOrg(
  providerId: string,
  organizationId: string
): Promise<mcpProviders.MCPProviderProfile | null> {
  const profile = await mcpProviders.findProfileById(providerId);
  if (!profile || !profile.is_active || !profile.oauth_config) return null;
  if (!mcpProviders.isProfileVisibleToOrg(profile, organizationId)) return null;
  return profile;
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function startAuthorization(input: {
  organizationId: string;
  agentId: string;
  userId: string;
  profile: mcpProviders.MCPProviderProfile;
  redirectUri: string;
}): Promise<string> {
  const cfg = input.profile.oauth_config;
  if (!cfg) throw new AppError(400, 'Provider does not use OAuth', 'OAUTH_NOT_SUPPORTED');
  return startAuthorizationCore(realDeps, {
    organizationId: input.organizationId,
    agentId: input.agentId,
    userId: input.userId,
    providerId: input.profile.id,
    redirectUri: input.redirectUri,
    config: {
      authorizationEndpoint: cfg.authorization_endpoint,
      clientId: await resolveClientId(input.profile),
      scope: cfg.scope,
      resource: cfg.resource,
    },
  });
}

/**
 * Public callback, step 1: does NOT exchange the code nor consume the state. Verifies the state
 * exists for this provider and parks {state, code} in a single-use ticket (5 min). Returns the
 * agent to redirect to plus the ticket, or null when the state is invalid/expired.
 */
export async function createCallbackTicket(input: {
  state: string;
  code: string;
  providerId: string;
}): Promise<{ agentId: string; ticket: string } | null> {
  const st = await peekState(realDeps, input.state);
  if (!st || st.providerId !== input.providerId) return null;
  const ticket = await createTicket(realDeps, { state: input.state, code: input.code });
  return { agentId: st.agentId, ticket };
}

/** Provider returned an error (user denied): consume the state only to learn which agent to go back to. */
export async function consumeStateAgentId(state: string, providerId: string): Promise<string | undefined> {
  try {
    const st = await consumeState(realDeps, state);
    return st.providerId === providerId ? st.agentId : undefined;
  } catch {
    return undefined;
  }
}

export interface CompletedAuthorization {
  agentId: string;
  providerId: string;
  toolId: string;
}

/**
 * Authenticated completion (step 2). The state must have been started by this same user, org, agent
 * and provider; otherwise McpOAuthForbiddenError and NO call to the token endpoint.
 */
export async function completeAuthorizationWithTicket(input: {
  ticket: string;
  organizationId: string;
  agentId: string;
  providerId: string;
  userId: string;
}): Promise<CompletedAuthorization> {
  const { state: st, code } = await claimTicket(realDeps, input);
  try {
    return await finishAuthorization(st, code);
  } catch (err) {
    if (err instanceof McpOAuthStateError || err instanceof McpOAuthForbiddenError) throw err;
    const reason = err instanceof McpOAuthExchangeError ? 'exchange_failed' : 'server_error';
    if (reason === 'server_error') console.error('[mcp-oauth] Completing authorization failed:', (err as Error).message);
    throw new McpOAuthCompletionError(reason);
  }
}

/** Failure after the ticket/state were consumed (exchange or persistence). */
export class McpOAuthCompletionError extends Error {
  constructor(readonly reason: 'exchange_failed' | 'server_error') {
    super(reason);
    this.name = 'McpOAuthCompletionError';
  }
}

async function finishAuthorization(st: OAuthStatePayload, code: string): Promise<CompletedAuthorization> {

  const profile = await findOAuthProfileForOrg(st.providerId, st.organizationId);
  if (!profile || !profile.oauth_config) throw new McpOAuthStateError('Provider no longer available');

  // Re-verify that the agent still belongs to the org that started the flow.
  try {
    await agentService.verifyAgentOwnership(st.organizationId, st.agentId);
  } catch {
    throw new McpOAuthStateError('Agent not found');
  }

  const tokens = await exchangeAuthorizationCode(realDeps, {
    endpoints: await endpointsFor(profile),
    code,
    redirectUri: st.redirectUri,
    codeVerifier: st.codeVerifier,
  });
  const oauth = buildStoredOAuth(realDeps, tokens);

  const serverUrl = profile.default_server_url ?? '';
  if (!serverUrl) throw new AppError(500, 'Provider has no default server URL', 'PROVIDER_MISCONFIGURED');
  const transport = profile.default_transport;

  const existing = await query<{ id: string; config: Record<string, unknown> }>(
    `SELECT id, config FROM agent_tools WHERE agent_id = $1 AND type = 'mcp' AND config->>'providerId' = $2 ORDER BY created_at ASC LIMIT 1`,
    [st.agentId, profile.id]
  );

  let toolId: string;
  let selectedTools: string[];
  const prev = existing.rows[0];
  if (prev) {
    toolId = prev.id;
    selectedTools = Array.isArray(prev.config['selected_tools']) ? (prev.config['selected_tools'] as string[]) : [];
    const previousConnectedAt = (prev.config['oauth'] as Partial<StoredOAuth> | undefined)?.connected_at;
    // 1) Rest of the config (selected_tools, name, ...) WITHOUT oauth: updateTool keeps the DB's oauth.
    const { oauth: _prevOAuth, ...restConfig } = prev.config;
    void _prevOAuth;
    await agentService.updateTool(st.organizationId, st.agentId, toolId, {
      config: { ...restConfig, server_url: serverUrl, transport, providerId: profile.id },
      isEnabled: true,
    });
    // 2) Replace the whole oauth block (no merge, nothing of the previous session survives).
    await replaceOAuth(toolId, st.agentId, { ...oauth, connected_at: previousConnectedAt ?? oauth.connected_at });
  } else {
    const config: Record<string, unknown> = {
      server_url: serverUrl,
      name: profile.name,
      transport,
      selected_tools: [] as string[],
      headers: [] as EncryptedHeader[],
      providerId: profile.id,
      oauth,
    };
    const created = await agentService.createTool(st.organizationId, st.agentId, {
      type: 'mcp',
      name: profile.name,
      description: profile.description ?? undefined,
      config,
    });
    toolId = created.id;
    selectedTools = [];
  }

  await redis.del(`mcp:tools:${toolId}`).catch(() => {});

  if (selectedTools.length === 0) {
    const discovered = await connectAndListTools(serverUrl, transport, {
      Authorization: `Bearer ${tokens.accessToken}`,
      'X-Agent-ID': st.agentId,
      'X-Session-ID': randomUUID(),
    });
    // Merge in SQL so the freshly stored oauth block is not overwritten by a stale copy.
    await query(
      `UPDATE agent_tools SET config = jsonb_set(config, '{selected_tools}', $3::jsonb, true), updated_at = NOW()
        WHERE id = $1 AND agent_id = $2`,
      [toolId, st.agentId, JSON.stringify(discovered.map((t) => t.name))]
    );
    await redis.del(`mcp:tools:${toolId}`).catch(() => {});
  }

  console.log(`[mcp-oauth] Connected provider ${profile.id} for agent ${st.agentId} (tool ${toolId})`);
  return { agentId: st.agentId, providerId: profile.id, toolId };
}

/** Returns a valid access token, refreshing under a distributed lock when needed. */
export async function getValidAccessToken(input: {
  toolId: string;
  agentId: string;
  providerId: string;
  forceRefresh?: boolean;
  staleAccessToken?: string;
}): Promise<string> {
  return getValidAccessTokenCore(realDeps, {
    toolId: input.toolId,
    agentId: input.agentId,
    forceRefresh: input.forceRefresh,
    staleAccessToken: input.staleAccessToken,
    getEndpoints: async () => {
      const profile = await mcpProviders.findProfileById(input.providerId);
      if (!profile || !profile.oauth_config) throw new McpOAuthReconnectRequiredError('Provider not available');
      return endpointsFor(profile);
    },
  });
}

export async function markNeedsReconnect(toolId: string, agentId: string): Promise<void> {
  await markNeedsReconnectCore(realDeps, toolId, agentId);
  await redis.del(`mcp:tools:${toolId}`).catch(() => {});
}

// ── Shared header assembly (worker, preview, test-connection) ────────────────

export interface McpToolConfigShape {
  server_url?: string;
  serverUrl?: string;
  headers?: EncryptedHeader[];
  webhookSecret_encrypted?: string;
  providerId?: string;
  oauth?: Partial<StoredOAuth>;
}

export interface McpOAuthContext {
  toolId: string;
  agentId: string;
  providerId: string;
  /** Provider display name for the neutral message shown to the LLM. */
  providerName: string;
}

export interface BuiltMcpHeaders {
  headers: Record<string, string>;
  /** Present when the Bearer was injected; used for 401 retry and revocation handling. */
  oauth: McpOAuthContext | null;
  /** True when the tool uses OAuth but is in needs_reconnect (callers must not list it). */
  needsReconnect: boolean;
}

/**
 * The 3-layer header merge shared by worker and preview (profile auto → user → system), plus the
 * OAuth Bearer as the FINAL layer. Behavior for non-OAuth providers is identical to the previous
 * inline code in each caller.
 */
export async function buildMcpToolHeaders(input: {
  logPrefix: string;
  toolId: string;
  agentId: string;
  sessionId: string;
  serverUrl: string;
  cfg: McpToolConfigShape;
}): Promise<BuiltMcpHeaders> {
  const { logPrefix, toolId, agentId, sessionId, serverUrl, cfg } = input;
  let profileAutoHeaders: Record<string, string> = {};
  let oauthProfile: mcpProviders.MCPProviderProfile | null = null;

  if (cfg.providerId) {
    try {
      const profile = await mcpProviders.findProfileById(cfg.providerId);
      if (profile && profile.is_active) {
        if (serverUrlMatchesProfile(profile, serverUrl)) {
          profileAutoHeaders = await mcpProviders.resolveAutoHeaders(profile);
          if (profile.oauth_config) oauthProfile = profile;
        } else {
          console.error(`${logPrefix} Tool ${toolId} server_url does not match provider ${cfg.providerId}; provider headers not sent`);
        }
      }
    } catch (err) {
      console.error(`${logPrefix} Failed to resolve provider ${cfg.providerId} for tool ${toolId}:`, (err as Error).message);
    }
  }

  const userHeaders = decryptHeaders(cfg.headers);
  const autoHeaders: Record<string, string> = { 'X-Agent-ID': agentId, 'X-Session-ID': sessionId };
  if (cfg.webhookSecret_encrypted) {
    try {
      autoHeaders['X-Webhook-Secret'] = decrypt(cfg.webhookSecret_encrypted);
    } catch (err) {
      console.error(`${logPrefix} Failed to decrypt webhookSecret for tool ${toolId}:`, (err as Error).message);
    }
  }
  const headers: Record<string, string> = { ...profileAutoHeaders, ...userHeaders, ...autoHeaders };

  if (!oauthProfile || !cfg.oauth) return { headers, oauth: null, needsReconnect: false };

  if (cfg.oauth.status === 'needs_reconnect') {
    console.warn(`[mcp-oauth] Tool ${toolId} needs reconnect; not listing its tools`);
    return { headers, oauth: null, needsReconnect: true };
  }

  const ctx: McpOAuthContext = { toolId, agentId, providerId: oauthProfile.id, providerName: oauthProfile.name };
  try {
    headers['Authorization'] = `Bearer ${await getValidAccessToken(ctx)}`;
  } catch (err) {
    if (err instanceof McpOAuthReconnectRequiredError) {
      console.warn(`[mcp-oauth] Tool ${toolId} needs reconnect; not listing its tools`);
      return { headers, oauth: null, needsReconnect: true };
    }
    // Transient failure: let the caller degrade (its catch logs and skips the tool).
    throw err;
  }
  return { headers, oauth: ctx, needsReconnect: false };
}

/**
 * Executes an MCP tool. When `oauth` is set: on HTTP 401 forces ONE token refresh and retries ONCE;
 * on revocation marks needs_reconnect and returns a neutral message for the LLM.
 * Without `oauth` it is a plain executeMCPTool (other providers unchanged).
 */
export async function executeMCPToolWithOAuth(
  serverUrl: string,
  toolName: string,
  args: Record<string, unknown>,
  transport: 'sse' | 'streamable-http',
  headers: Record<string, string>,
  oauth: McpOAuthContext | null | undefined
): Promise<MCPToolResult> {
  if (!oauth) return executeMCPTool(serverUrl, toolName, args, transport, headers);
  return executeWithOAuthCore(
    {
      execute: (h) => executeMCPTool(serverUrl, toolName, args, transport, h),
      getToken: (opts) => getValidAccessToken({ ...oauth, ...opts }),
      providerName: oauth.providerName,
      markNeedsReconnect: () => markNeedsReconnect(oauth.toolId, oauth.agentId),
      log: realDeps.log,
    },
    headers
  );
}
