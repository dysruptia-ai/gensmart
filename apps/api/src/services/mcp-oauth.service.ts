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
import { safeUndiciFetch, readBodyLimited, BodyTooLargeError } from './safe-url';
import * as mcpProviders from './mcp-providers.service';
import * as agentService from './agent.service';
import { connectAndListTools, executeMCPTool, type MCPToolResult } from './mcp-client.service';
import { decryptHeaders, type EncryptedHeader } from './mcp-headers.service';
import { serverUrlMatchesProfile } from './mcp-provider-url';
import { revokeOAuthSession } from './mcp-oauth-revoke.service';
import { resolveOAuthEndpoints, type ResolvedOAuthEndpoints, type ResolveOptions } from './mcp-oauth-discovery.service';
import {
  startAuthorizationCore,
  consumeState,
  peekState,
  createTicket,
  claimTicket,
  exchangeAuthorizationCode,
  buildStoredOAuth,
  getValidAccessTokenWithSessionCore,
  markNeedsReconnectCore,
  executeWithOAuthCore,
  withRefreshLockCore,
  selectedToolsAfterConnect,
  profileOmitsGenSmartHeaders,
  revokePreviousIfAccountChangedCore,
  type AccessTokenWithSession,
  McpOAuthReconnectRequiredError,
  McpOAuthStateError,
  McpOAuthExchangeError,
  McpOAuthForbiddenError,
  type OAuthStatePayload,
  type OAuthDeps,
  type OAuthEndpoints,
  type AuthorizeConfig,
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
  profileOmitsGenSmartHeaders,
} from './mcp-oauth.core';

const HTTP_TIMEOUT_MS = 15_000;
/** Cap for token endpoint responses (decoded). Beyond it the body is treated as unreadable (null). */
export const TOKEN_RESPONSE_MAX_BYTES = 64 * 1024;

// ── Real dependencies ────────────────────────────────────────────────────────

const RELEASE_LOCK_LUA = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;
/** Compare-and-extend: only if the lock is still ours, raise its TTL to at least ARGV[2] ms (never shortens). */
const EXTEND_LOCK_LUA = `if redis.call("get", KEYS[1]) == ARGV[1] then
  if redis.call("pttl", KEYS[1]) < tonumber(ARGV[2]) then redis.call("pexpire", KEYS[1], ARGV[2]) end
  return 1
else return 0 end`;

/**
 * Token endpoint POST (code exchange and refresh). 15 s total (body included) and a 64 KB cap on the
 * decoded body: a larger body is treated as unreadable (`body: null`), so a 2xx becomes "unreadable
 * token response" (refresh → reconnect, never a blind replay; exchange → failed) and a 4xx carries
 * error=unknown. Network errors and timeouts throw. Exported for tests.
 */
export async function postForm(
  url: string,
  form: Record<string, string>,
  opts: { timeoutMs?: number; maxBytes?: number } = {}
): Promise<HttpPostResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? HTTP_TIMEOUT_MS);
  try {
    const res = await safeUndiciFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams(form).toString(),
      signal: controller.signal,
    });
    let text: string;
    try {
      text = await readBodyLimited(res.body as ReadableStream<Uint8Array> | null, opts.maxBytes ?? TOKEN_RESPONSE_MAX_BYTES);
    } catch (err) {
      if (!(err instanceof BodyTooLargeError)) throw err;
      console.warn(`[mcp-oauth] Token endpoint response over ${opts.maxBytes ?? TOKEN_RESPONSE_MAX_BYTES} bytes (HTTP ${res.status}); treated as unreadable`);
      return { status: res.status, body: null };
    }
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
 * Callers must hold the per-tool refresh lock (withRefreshLockCore).
 */
async function replaceOAuth(toolId: string, agentId: string, oauth: StoredOAuth): Promise<void> {
  await query(
    `UPDATE agent_tools SET config = jsonb_set(config, '{oauth}', $3::jsonb, true), is_enabled = true, updated_at = NOW()
      WHERE id = $1 AND agent_id = $2`,
    [toolId, agentId, JSON.stringify(oauth)]
  );
}

/** Exported for the DB integration test; production callers go through the core. */
export async function mergeOAuth(
  toolId: string,
  agentId: string,
  patch: Partial<StoredOAuth>,
  sessionId: string | null
): Promise<boolean> {
  // Merge only config.oauth in one UPDATE: concurrent edits to other config keys are not overwritten.
  // Applied only while the stored block is still the same session (NULL = legacy block without id),
  // so a late write of an old session never lands on a reconnected one.
  const r = await query(
    `UPDATE agent_tools
        SET config = jsonb_set(config, '{oauth}', config->'oauth' || $3::jsonb, true),
            updated_at = NOW()
      WHERE id = $1 AND agent_id = $2
        AND config ? 'oauth'
        AND (config->'oauth'->>'session_id') IS NOT DISTINCT FROM $4::text`,
    [toolId, agentId, JSON.stringify(patch), sessionId]
  );
  return (r.rowCount ?? 0) > 0;
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
    extendIfEquals: async (key, value, ms) => (await redis.eval(EXTEND_LOCK_LUA, 1, key, value, String(ms))) === 1,
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

/**
 * Endpoint + client_id resolution for a profile. Endpoints come from discovery (profiles with
 * oauth_config.discovery.enabled) or from oauth_config; client_id, scope and resource ALWAYS come
 * from oauth_config. Injectable for tests.
 */
export interface ProfileEndpointDeps {
  resolveEndpoints: (profile: mcpProviders.MCPProviderProfile, opts?: ResolveOptions) => Promise<ResolvedOAuthEndpoints>;
  resolveClientId: (profile: mcpProviders.MCPProviderProfile) => Promise<string>;
}

const realProfileEndpointDeps: ProfileEndpointDeps = {
  resolveEndpoints: (profile, opts) => resolveOAuthEndpoints(profile, opts),
  resolveClientId,
};

/** Authorization request settings (the authorize URL goes to the browser: discovered only within the allow-list). */
export async function authorizeConfigFor(
  profile: mcpProviders.MCPProviderProfile,
  deps: ProfileEndpointDeps = realProfileEndpointDeps
): Promise<AuthorizeConfig> {
  const cfg = profile.oauth_config;
  if (!cfg) throw new AppError(400, 'Provider does not use OAuth', 'OAUTH_NOT_SUPPORTED');
  const resolved = await deps.resolveEndpoints(profile);
  return {
    authorizationEndpoint: resolved.authorizationEndpoint,
    clientId: await deps.resolveClientId(profile),
    scope: cfg.scope,
    resource: cfg.resource,
  };
}

/** Token endpoint settings for code exchange and refresh. */
export async function tokenEndpointsFor(
  profile: mcpProviders.MCPProviderProfile,
  deps: ProfileEndpointDeps = realProfileEndpointDeps
): Promise<OAuthEndpoints> {
  const cfg = profile.oauth_config;
  if (!cfg) throw new AppError(400, 'Provider does not use OAuth', 'OAUTH_NOT_SUPPORTED');
  const resolved = await deps.resolveEndpoints(profile);
  return { tokenEndpoint: resolved.tokenEndpoint, clientId: await deps.resolveClientId(profile), resource: cfg.resource };
}

/**
 * After a suspicious refresh rejection: forces a new discovery and returns the token endpoint only
 * when it was freshly DISCOVERED (validated). Cached/static fallbacks return null: no retry on them.
 */
export async function rediscoverTokenEndpoint(
  profile: mcpProviders.MCPProviderProfile,
  deps: ProfileEndpointDeps = realProfileEndpointDeps
): Promise<string | null> {
  // Profiles without discovery have nothing to re-discover (static endpoints only).
  if (profile.oauth_config?.discovery?.enabled !== true) return null;
  const resolved = await deps.resolveEndpoints(profile, { forceRefresh: true });
  return resolved.source === 'discovered' ? resolved.tokenEndpoint : null;
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
  return startAuthorizationCore(realDeps, {
    organizationId: input.organizationId,
    agentId: input.agentId,
    userId: input.userId,
    providerId: input.profile.id,
    redirectUri: input.redirectUri,
    config: await authorizeConfigFor(input.profile),
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

  const serverUrl = profile.default_server_url ?? '';
  if (!serverUrl) throw new AppError(500, 'Provider has no default server URL', 'PROVIDER_MISCONFIGURED');
  const transport = profile.default_transport;
  const omitGenSmartHeaders = profileOmitsGenSmartHeaders(profile);
  const endpoints = await tokenEndpointsFor(profile);
  const exchange = () =>
    exchangeAuthorizationCode(realDeps, { endpoints, code, redirectUri: st.redirectUri, codeVerifier: st.codeVerifier });

  const existing = await query<{ id: string }>(
    `SELECT id FROM agent_tools WHERE agent_id = $1 AND type = 'mcp' AND config->>'providerId' = $2 ORDER BY created_at ASC LIMIT 1`,
    [st.agentId, profile.id]
  );

  let toolId: string;
  let accessToken: string;
  let previousOAuth: Partial<StoredOAuth> | null = null;
  const isReconnect = !!existing.rows[0];

  if (existing.rows[0]) {
    toolId = existing.rows[0].id;
    // Reconnection holds the same lock as the refresh: it never interleaves with an in-flight
    // refresh of the previous session. On timeout: generic "try again" (code not exchanged).
    const done = await withRefreshLockCore(realDeps, toolId, async () => {
      // Read under the lock: the previous block may have just been rotated.
      const cur = await query<{ config: Record<string, unknown> }>(
        'SELECT config FROM agent_tools WHERE id = $1 AND agent_id = $2',
        [toolId, st.agentId]
      );
      const prevConfig = cur.rows[0]?.config ?? {};
      const prevOAuth = (prevConfig['oauth'] as Partial<StoredOAuth> | undefined) ?? null;

      const tokens = await exchange();
      const oauth = buildStoredOAuth(realDeps, tokens);

      // 1) Rest of the config (selected_tools, name, ...) WITHOUT oauth: updateTool keeps the DB's oauth.
      const { oauth: _prevOAuth, ...restConfig } = prevConfig;
      void _prevOAuth;
      // Providers without webhook events get no GenSmart secret: drop any stored one.
      if (omitGenSmartHeaders) delete restConfig['webhookSecret_encrypted'];
      await agentService.updateTool(st.organizationId, st.agentId, toolId, {
        config: { ...restConfig, server_url: serverUrl, transport, providerId: profile.id },
        isEnabled: true,
      });
      // 2) Replace the whole oauth block (new session_id; nothing of the previous session survives).
      await replaceOAuth(toolId, st.agentId, { ...oauth, connected_at: prevOAuth?.connected_at ?? oauth.connected_at });
      return { accessToken: tokens.accessToken, prevOAuth };
    });
    accessToken = done.accessToken;
    previousOAuth = done.prevOAuth;
  } else {
    const tokens = await exchange();
    accessToken = tokens.accessToken;
    const config: Record<string, unknown> = {
      server_url: serverUrl,
      name: profile.name,
      transport,
      selected_tools: [] as string[],
      headers: [] as EncryptedHeader[],
      providerId: profile.id,
      oauth: buildStoredOAuth(realDeps, tokens),
    };
    const created = await agentService.createTool(st.organizationId, st.agentId, {
      type: 'mcp',
      name: profile.name,
      description: profile.description ?? undefined,
      config,
    });
    toolId = created.id;
  }

  await redis.del(`mcp:tools:${toolId}`).catch(() => {});

  // Best-effort revocation of the replaced session, after the new one is stored, ONLY when the
  // provider account changed (JWT `sub` compared, never used to authorize). Never blocks.
  if (previousOAuth) {
    void revokePreviousIfAccountChangedCore(
      { decrypt, revoke: (prev) => revokeOAuthSession(prev, profile), log: realDeps.log },
      previousOAuth,
      accessToken
    ).catch(() => {});
  }

  // First connection only: default selection from the profile (Dropi: read-only catalog/logistics,
  // no buyer data, no order creation). A reconnection keeps the user's selection untouched.
  if (!isReconnect) {
    const discoveryHeaders: Record<string, string> = { Authorization: `Bearer ${accessToken}` };
    if (!omitGenSmartHeaders) {
      discoveryHeaders['X-Agent-ID'] = st.agentId;
      discoveryHeaders['X-Session-ID'] = randomUUID();
    }
    const discovered = await connectAndListTools(serverUrl, transport, discoveryHeaders);
    const selection = selectedToolsAfterConnect({
      isReconnect,
      discovered: discovered.map((t) => t.name),
      profileDefaults: profile.default_selected_tools,
    });
    if (selection) {
      // Merge in SQL so the freshly stored oauth block is not overwritten by a stale copy.
      await query(
        `UPDATE agent_tools SET config = jsonb_set(config, '{selected_tools}', $3::jsonb, true), updated_at = NOW()
          WHERE id = $1 AND agent_id = $2`,
        [toolId, st.agentId, JSON.stringify(selection)]
      );
      await redis.del(`mcp:tools:${toolId}`).catch(() => {});
    }
  }

  console.log(`[mcp-oauth] Connected provider ${profile.id} for agent ${st.agentId} (tool ${toolId})`);
  return { agentId: st.agentId, providerId: profile.id, toolId };
}

/** Returns a valid access token (and its session), refreshing under a distributed lock when needed. */
export async function getValidAccessTokenWithSession(input: {
  toolId: string;
  agentId: string;
  providerId: string;
  forceRefresh?: boolean;
  staleAccessToken?: string;
}): Promise<AccessTokenWithSession> {
  let profile: mcpProviders.MCPProviderProfile | null = null;
  const loadProfile = async (): Promise<mcpProviders.MCPProviderProfile> => {
    profile ??= await mcpProviders.findProfileById(input.providerId);
    if (!profile || !profile.oauth_config) throw new McpOAuthReconnectRequiredError('Provider not available');
    return profile;
  };
  return getValidAccessTokenWithSessionCore(realDeps, {
    toolId: input.toolId,
    agentId: input.agentId,
    forceRefresh: input.forceRefresh,
    staleAccessToken: input.staleAccessToken,
    providerId: input.providerId,
    getEndpoints: async () => tokenEndpointsFor(await loadProfile()),
    rediscoverTokenEndpoint: async () => rediscoverTokenEndpoint(await loadProfile()),
  });
}

/** Marks needs_reconnect only if the tool is still on session `sessionId` (null = legacy block). */
export async function markNeedsReconnect(toolId: string, agentId: string, sessionId: string | null): Promise<void> {
  await markNeedsReconnectCore(realDeps, toolId, agentId, sessionId);
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
  /** session_id of the stored OAuth block the injected Bearer belongs to (null = legacy). */
  sessionId: string | null;
}

export interface BuiltMcpHeaders {
  headers: Record<string, string>;
  /** Present when the Bearer was injected; used for 401 retry and revocation handling. */
  oauth: McpOAuthContext | null;
  /** True when the tool uses OAuth but is in needs_reconnect (callers must not list it). */
  needsReconnect: boolean;
}

/** Injectable dependencies of buildMcpToolHeaders (real ones by default; fakes in tests). */
export interface BuildHeadersDeps {
  findProfileById: (id: string) => Promise<mcpProviders.MCPProviderProfile | null>;
  resolveAutoHeaders: (profile: mcpProviders.MCPProviderProfile) => Promise<Record<string, string>>;
  decryptHeaders: (headers: EncryptedHeader[] | undefined) => Record<string, string>;
  decrypt: (text: string) => string;
  getToken: (ctx: { toolId: string; agentId: string; providerId: string }) => Promise<AccessTokenWithSession>;
}

const realBuildHeadersDeps: BuildHeadersDeps = {
  findProfileById: (id) => mcpProviders.findProfileById(id),
  resolveAutoHeaders: (p) => mcpProviders.resolveAutoHeaders(p),
  decryptHeaders: (h) => decryptHeaders(h),
  decrypt: (t) => decrypt(t),
  getToken: (ctx) => getValidAccessTokenWithSession(ctx),
};

/**
 * The 3-layer header merge shared by worker and preview (profile auto → user → system), plus the
 * OAuth Bearer as the FINAL layer. Behavior for non-OAuth providers is identical to the previous
 * inline code in each caller. OAuth providers without webhook events (e.g. Dropi) do not receive
 * GenSmart's own system headers (X-Webhook-Secret, X-Agent-ID, X-Session-ID).
 *
 * Beta gating (allowed_org_ids) is deliberately NOT applied here, nor in preview or refresh:
 * removing an org from a beta does not disconnect the tools it already created (product decision).
 * Gating applies when creating/changing the provider (catalog, POST/PUT tools, OAuth start, test).
 */
export async function buildMcpToolHeaders(
  input: {
    logPrefix: string;
    toolId: string;
    agentId: string;
    sessionId: string;
    serverUrl: string;
    cfg: McpToolConfigShape;
  },
  deps: BuildHeadersDeps = realBuildHeadersDeps
): Promise<BuiltMcpHeaders> {
  const { logPrefix, toolId, agentId, sessionId, serverUrl, cfg } = input;
  let profileAutoHeaders: Record<string, string> = {};
  let oauthProfile: mcpProviders.MCPProviderProfile | null = null;
  let omitGenSmartHeaders = false;

  if (cfg.providerId) {
    try {
      const profile = await deps.findProfileById(cfg.providerId);
      if (profile && profile.is_active) {
        omitGenSmartHeaders = profileOmitsGenSmartHeaders(profile);
        if (serverUrlMatchesProfile(profile, serverUrl)) {
          profileAutoHeaders = await deps.resolveAutoHeaders(profile);
          if (profile.oauth_config) oauthProfile = profile;
        } else {
          console.error(`${logPrefix} Tool ${toolId} server_url does not match provider ${cfg.providerId}; provider headers not sent`);
        }
      }
    } catch (err) {
      console.error(`${logPrefix} Failed to resolve provider ${cfg.providerId} for tool ${toolId}:`, (err as Error).message);
    }
  }

  const userHeaders = deps.decryptHeaders(cfg.headers);
  const autoHeaders: Record<string, string> = {};
  if (!omitGenSmartHeaders) {
    autoHeaders['X-Agent-ID'] = agentId;
    autoHeaders['X-Session-ID'] = sessionId;
    if (cfg.webhookSecret_encrypted) {
      try {
        autoHeaders['X-Webhook-Secret'] = deps.decrypt(cfg.webhookSecret_encrypted);
      } catch (err) {
        console.error(`${logPrefix} Failed to decrypt webhookSecret for tool ${toolId}:`, (err as Error).message);
      }
    }
  }
  const headers: Record<string, string> = { ...profileAutoHeaders, ...userHeaders, ...autoHeaders };

  if (!oauthProfile || !cfg.oauth) return { headers, oauth: null, needsReconnect: false };

  if (cfg.oauth.status === 'needs_reconnect') {
    console.warn(`[mcp-oauth] Tool ${toolId} needs reconnect; not listing its tools`);
    return { headers, oauth: null, needsReconnect: true };
  }

  try {
    const tok = await deps.getToken({ toolId, agentId, providerId: oauthProfile.id });
    headers['Authorization'] = `Bearer ${tok.accessToken}`;
    const ctx: McpOAuthContext = {
      toolId,
      agentId,
      providerId: oauthProfile.id,
      providerName: oauthProfile.name,
      sessionId: tok.sessionId,
    };
    return { headers, oauth: ctx, needsReconnect: false };
  } catch (err) {
    if (err instanceof McpOAuthReconnectRequiredError) {
      console.warn(`[mcp-oauth] Tool ${toolId} needs reconnect; not listing its tools`);
      return { headers, oauth: null, needsReconnect: true };
    }
    // Transient failure: let the caller degrade (its catch logs and skips the tool).
    throw err;
  }
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
      getToken: (opts) =>
        getValidAccessTokenWithSession({ toolId: oauth.toolId, agentId: oauth.agentId, providerId: oauth.providerId, ...opts }),
      providerName: oauth.providerName,
      markNeedsReconnect: (sessionId) => markNeedsReconnect(oauth.toolId, oauth.agentId, sessionId),
      log: realDeps.log,
    },
    headers,
    oauth.sessionId
  );
}
