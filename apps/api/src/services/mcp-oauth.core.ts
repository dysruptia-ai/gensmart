/**
 * MCP OAuth 2.1 (PKCE, public client) — pure core with injectable dependencies.
 *
 * No imports from config/database/redis so it can be unit-tested with fakes.
 * The real wiring (Redis, Postgres, safeUndiciFetch, encryption) lives in
 * mcp-oauth.service.ts.
 *
 * CRITICAL DESIGN CONSTRAINT: the provider (Dropi) ROTATES the refresh token on
 * every use and revokes the WHOLE session if an already-used refresh token is
 * replayed. Therefore a refresh must be serialized per tool with a distributed
 * lock, must re-read the stored token after acquiring the lock, must persist the
 * new pair atomically, and must NEVER retry with the old refresh token.
 *
 * Logs use the `[mcp-oauth]` prefix and never include tokens, codes or verifiers.
 */

import crypto from 'crypto';

// ── Types ────────────────────────────────────────────────────────────────────

export interface StoredOAuth {
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  /** ISO timestamp */
  expires_at: string;
  status: 'connected' | 'needs_reconnect';
  connected_at: string;
  updated_at: string;
}

export interface OAuthEndpoints {
  tokenEndpoint: string;
  clientId: string;
  resource?: string;
}

export interface OAuthStatePayload {
  organizationId: string;
  agentId: string;
  providerId: string;
  codeVerifier: string;
  redirectUri: string;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface HttpPostResult {
  status: number;
  body: unknown;
}

export interface OAuthDeps {
  /** Redis-like key/value store. */
  kv: {
    /** SET key value EX seconds */
    setEx(key: string, value: string, seconds: number): Promise<void>;
    /** Atomic GET + DEL. */
    getDel(key: string): Promise<string | null>;
    /** SET key value PX ms NX. Returns true when the lock was acquired. */
    setNxPx(key: string, value: string, ms: number): Promise<boolean>;
    /** Delete key only if its value equals `value` (atomic). */
    delIfEquals(key: string, value: string): Promise<void>;
  };
  /** Reads `agent_tools.config.oauth` of a tool; null when the tool or oauth block does not exist. */
  loadOAuth(toolId: string, agentId: string): Promise<StoredOAuth | null>;
  /** Single atomic UPDATE merging these fields into config.oauth (never touching other config keys). */
  mergeOAuth(toolId: string, agentId: string, patch: Partial<StoredOAuth>): Promise<void>;
  /** Form-urlencoded POST. Network errors must throw. */
  postForm(url: string, form: Record<string, string>): Promise<HttpPostResult>;
  encrypt(text: string): string;
  decrypt(text: string): string;
  now(): number;
  sleep(ms: number): Promise<void>;
  randomBytes(n: number): Buffer;
  randomUUID(): string;
  log: { info(msg: string): void; warn(msg: string): void; error(msg: string): void };
}

// ── Errors ───────────────────────────────────────────────────────────────────

export class McpOAuthReconnectRequiredError extends Error {
  readonly code = 'OAUTH_RECONNECT_REQUIRED';
  constructor(message = 'MCP OAuth connection must be re-established') {
    super(message);
    this.name = 'McpOAuthReconnectRequiredError';
  }
}

/** Network / 5xx / timeout while talking to the authorization server. Stored tokens are untouched. */
export class McpOAuthTransientError extends Error {
  readonly code = 'OAUTH_TRANSIENT';
  constructor(message: string) {
    super(message);
    this.name = 'McpOAuthTransientError';
  }
}

export class McpOAuthStateError extends Error {
  readonly code = 'CONNECT_SESSION_EXPIRED';
  constructor(message = 'OAuth state invalid or expired') {
    super(message);
    this.name = 'McpOAuthStateError';
  }
}

export class McpOAuthExchangeError extends Error {
  readonly code = 'TOKEN_EXCHANGE_FAILED';
  constructor(message: string) {
    super(message);
    this.name = 'McpOAuthExchangeError';
  }
}

// ── Constants ────────────────────────────────────────────────────────────────

export const STATE_KEY_PREFIX = 'mcp:oauth:state:';
export const REFRESH_LOCK_PREFIX = 'mcp:oauth:refresh-lock:';
export const STATE_TTL_SECONDS = 600;
export const REFRESH_LOCK_TTL_MS = 20_000;
export const LOCK_WAIT_POLL_MS = 250;
export const LOCK_WAIT_MAX_MS = 10_000;
export const REFRESH_MARGIN_MS = 5 * 60 * 1000;
const STATE_PATTERN = /^[a-f0-9]{48}$/;

// ── PKCE ─────────────────────────────────────────────────────────────────────

export function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function codeChallengeS256(verifier: string): string {
  return base64url(crypto.createHash('sha256').update(verifier, 'ascii').digest());
}

export function generatePkce(randomBytes: (n: number) => Buffer = crypto.randomBytes): {
  verifier: string;
  challenge: string;
} {
  const verifier = base64url(randomBytes(32));
  return { verifier, challenge: codeChallengeS256(verifier) };
}

// ── Authorization start / state ──────────────────────────────────────────────

export interface AuthorizeConfig {
  authorizationEndpoint: string;
  clientId: string;
  scope: string;
  resource?: string;
}

export async function startAuthorizationCore(
  deps: OAuthDeps,
  input: {
    organizationId: string;
    agentId: string;
    providerId: string;
    redirectUri: string;
    config: AuthorizeConfig;
  }
): Promise<string> {
  const { verifier, challenge } = generatePkce(deps.randomBytes);
  const state = deps.randomBytes(24).toString('hex');

  const payload: OAuthStatePayload = {
    organizationId: input.organizationId,
    agentId: input.agentId,
    providerId: input.providerId,
    codeVerifier: verifier,
    redirectUri: input.redirectUri,
  };
  await deps.kv.setEx(STATE_KEY_PREFIX + state, deps.encrypt(JSON.stringify(payload)), STATE_TTL_SECONDS);

  const url = new URL(input.config.authorizationEndpoint);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', input.config.clientId);
  url.searchParams.set('redirect_uri', input.redirectUri);
  url.searchParams.set('scope', input.config.scope);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  if (input.config.resource) url.searchParams.set('resource', input.config.resource);
  return url.toString();
}

/** Single use: atomically reads and deletes the state. Throws McpOAuthStateError when missing/expired/reused/corrupt. */
export async function consumeState(deps: OAuthDeps, state: string): Promise<OAuthStatePayload> {
  if (typeof state !== 'string' || !STATE_PATTERN.test(state)) throw new McpOAuthStateError();
  let raw: string | null;
  try {
    raw = await deps.kv.getDel(STATE_KEY_PREFIX + state);
  } catch {
    throw new McpOAuthStateError();
  }
  if (!raw) throw new McpOAuthStateError();
  try {
    const p = JSON.parse(deps.decrypt(raw)) as Partial<OAuthStatePayload>;
    if (!p.organizationId || !p.agentId || !p.providerId || !p.codeVerifier || !p.redirectUri) {
      throw new McpOAuthStateError();
    }
    return {
      organizationId: p.organizationId,
      agentId: p.agentId,
      providerId: p.providerId,
      codeVerifier: p.codeVerifier,
      redirectUri: p.redirectUri,
    };
  } catch {
    throw new McpOAuthStateError();
  }
}

// ── Token endpoint ───────────────────────────────────────────────────────────

function parseTokenBody(body: unknown): TokenResponse | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  if (typeof b['access_token'] !== 'string' || !b['access_token']) return null;
  if (typeof b['refresh_token'] !== 'string' || !b['refresh_token']) return null;
  const expiresIn = typeof b['expires_in'] === 'number' ? b['expires_in'] : Number(b['expires_in']);
  return {
    accessToken: b['access_token'],
    refreshToken: b['refresh_token'],
    expiresIn: Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600,
  };
}

function oauthErrorCode(body: unknown): string {
  if (typeof body === 'object' && body !== null) {
    const e = (body as Record<string, unknown>)['error'];
    if (typeof e === 'string') return e.slice(0, 64);
  }
  return 'unknown';
}

export async function exchangeAuthorizationCode(
  deps: OAuthDeps,
  input: { endpoints: OAuthEndpoints; code: string; redirectUri: string; codeVerifier: string }
): Promise<TokenResponse> {
  const form: Record<string, string> = {
    grant_type: 'authorization_code',
    code: input.code,
    redirect_uri: input.redirectUri,
    client_id: input.endpoints.clientId,
    code_verifier: input.codeVerifier,
  };
  if (input.endpoints.resource) form['resource'] = input.endpoints.resource;

  let res: HttpPostResult;
  try {
    res = await deps.postForm(input.endpoints.tokenEndpoint, form);
  } catch (err) {
    deps.log.error(`[mcp-oauth] Code exchange network error: ${(err as Error).message}`);
    throw new McpOAuthExchangeError('Could not reach the authorization server');
  }
  const tokens = res.status >= 200 && res.status < 300 ? parseTokenBody(res.body) : null;
  if (!tokens) {
    deps.log.error(`[mcp-oauth] Code exchange rejected (HTTP ${res.status}, error=${oauthErrorCode(res.body)})`);
    throw new McpOAuthExchangeError('Authorization code exchange failed');
  }
  return tokens;
}

export function buildStoredOAuth(deps: OAuthDeps, tokens: TokenResponse, connectedAt?: string): StoredOAuth {
  const nowIso = new Date(deps.now()).toISOString();
  return {
    access_token_encrypted: deps.encrypt(tokens.accessToken),
    refresh_token_encrypted: deps.encrypt(tokens.refreshToken),
    expires_at: new Date(deps.now() + tokens.expiresIn * 1000).toISOString(),
    status: 'connected',
    connected_at: connectedAt ?? nowIso,
    updated_at: nowIso,
  };
}

// ── Access token with locked refresh ─────────────────────────────────────────

function isFresh(deps: OAuthDeps, o: StoredOAuth): boolean {
  const exp = Date.parse(o.expires_at);
  return Number.isFinite(exp) && exp - deps.now() > REFRESH_MARGIN_MS;
}

export interface GetTokenInput {
  toolId: string;
  agentId: string;
  /** Resolves token endpoint + client_id (lazy: not needed when the stored token is fresh). */
  getEndpoints: () => Promise<OAuthEndpoints>;
  forceRefresh?: boolean;
  /**
   * With forceRefresh: the access token that just got rejected. If another process already
   * replaced it, that newer token is returned instead of rotating the refresh token again.
   */
  staleAccessToken?: string;
}

async function markReconnect(deps: OAuthDeps, toolId: string, agentId: string): Promise<void> {
  await deps.mergeOAuth(toolId, agentId, {
    status: 'needs_reconnect',
    updated_at: new Date(deps.now()).toISOString(),
  });
}

export async function markNeedsReconnectCore(deps: OAuthDeps, toolId: string, agentId: string): Promise<void> {
  await markReconnect(deps, toolId, agentId);
  deps.log.warn(`[mcp-oauth] Tool ${toolId} marked needs_reconnect`);
}

/** Returns the stored token if it can be used for this call (fresh, and not the rejected one when forcing). */
function usableStored(deps: OAuthDeps, o: StoredOAuth, input: GetTokenInput): string | null {
  if (o.status === 'needs_reconnect') throw new McpOAuthReconnectRequiredError();
  if (!isFresh(deps, o)) return null;
  const token = deps.decrypt(o.access_token_encrypted);
  if (input.forceRefresh) {
    // Only reuse a token that differs from the rejected one (someone else refreshed meanwhile).
    if (!input.staleAccessToken || token === input.staleAccessToken) return null;
  }
  return token;
}

export async function getValidAccessTokenCore(deps: OAuthDeps, input: GetTokenInput): Promise<string> {
  const { toolId, agentId } = input;
  const initial = await deps.loadOAuth(toolId, agentId);
  if (!initial) throw new McpOAuthReconnectRequiredError('No OAuth credentials stored for this tool');

  const direct = usableStored(deps, initial, input);
  if (direct) return direct;

  const lockKey = REFRESH_LOCK_PREFIX + toolId;
  const lockValue = deps.randomUUID();
  const deadline = deps.now() + LOCK_WAIT_MAX_MS;

  let acquired = await deps.kv.setNxPx(lockKey, lockValue, REFRESH_LOCK_TTL_MS);
  while (!acquired) {
    // Someone else is refreshing: poll the DB until their result lands.
    if (deps.now() >= deadline) {
      throw new McpOAuthTransientError('Timed out waiting for another token refresh');
    }
    await deps.sleep(LOCK_WAIT_POLL_MS);
    const current = await deps.loadOAuth(toolId, agentId);
    if (!current) throw new McpOAuthReconnectRequiredError('No OAuth credentials stored for this tool');
    const token = usableStored(deps, current, input);
    if (token) return token;
    // The lock holder may have finished and released without a usable token (error): try to take over.
    acquired = await deps.kv.setNxPx(lockKey, lockValue, REFRESH_LOCK_TTL_MS);
  }

  try {
    // Re-read under the lock: another process may have refreshed right before we got it.
    const stored = await deps.loadOAuth(toolId, agentId);
    if (!stored) throw new McpOAuthReconnectRequiredError('No OAuth credentials stored for this tool');
    const again = usableStored(deps, stored, input);
    if (again) return again;

    const endpoints = await input.getEndpoints();
    const refreshToken = deps.decrypt(stored.refresh_token_encrypted);
    const form: Record<string, string> = {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: endpoints.clientId,
    };
    if (endpoints.resource) form['resource'] = endpoints.resource;

    let res: HttpPostResult;
    try {
      res = await deps.postForm(endpoints.tokenEndpoint, form);
    } catch (err) {
      // Network/timeout: we do not know whether Dropi consumed the token. Leave stored tokens alone.
      deps.log.error(`[mcp-oauth] Refresh network error for tool ${toolId}: ${(err as Error).message}`);
      throw new McpOAuthTransientError('Could not reach the authorization server');
    }

    if (res.status >= 200 && res.status < 300) {
      const tokens = parseTokenBody(res.body);
      if (!tokens) {
        deps.log.error(`[mcp-oauth] Refresh returned an unparseable token response for tool ${toolId}`);
        throw new McpOAuthTransientError('Invalid token response from the authorization server');
      }
      const nowIso = new Date(deps.now()).toISOString();
      // New access + NEW refresh token + expiry in a single atomic UPDATE.
      await deps.mergeOAuth(toolId, agentId, {
        access_token_encrypted: deps.encrypt(tokens.accessToken),
        refresh_token_encrypted: deps.encrypt(tokens.refreshToken),
        expires_at: new Date(deps.now() + tokens.expiresIn * 1000).toISOString(),
        status: 'connected',
        updated_at: nowIso,
      });
      deps.log.info(`[mcp-oauth] Refreshed access token for tool ${toolId}`);
      return tokens.accessToken;
    }

    if (res.status === 400 || res.status === 401) {
      deps.log.warn(
        `[mcp-oauth] Refresh rejected for tool ${toolId} (HTTP ${res.status}, error=${oauthErrorCode(res.body)}); reconnect required`
      );
      await markReconnect(deps, toolId, agentId);
      throw new McpOAuthReconnectRequiredError();
    }

    deps.log.error(`[mcp-oauth] Refresh failed for tool ${toolId} (HTTP ${res.status}); tokens left untouched`);
    throw new McpOAuthTransientError(`Authorization server error (HTTP ${res.status})`);
  } finally {
    // Release only if the lock is still ours, and only AFTER the new tokens were persisted.
    await deps.kv.delIfEquals(lockKey, lockValue).catch(() => {});
  }
}

// ── Revocation detection ─────────────────────────────────────────────────────

/** Dropi: "sesión MCP no válida (token has been revoked): el usuario debe desconectar y volver a conectar…" */
export function isRevokedToolResult(content: string): boolean {
  return typeof content === 'string' && /token has been revoked/i.test(content);
}

export const OAUTH_UNAVAILABLE_MESSAGE =
  'La conexión con Dropi no está disponible en este momento; un asesor revisará el pedido.';

// ── Tool execution wrapper (401 retry + revocation handling) ─────────────────

export interface McpExecResult {
  content: string;
  isError: boolean;
}

export interface ExecuteWithOAuthDeps {
  execute: (headers: Record<string, string>) => Promise<McpExecResult>;
  getToken: (opts: { forceRefresh: boolean; staleAccessToken?: string }) => Promise<string>;
  markNeedsReconnect: () => Promise<void>;
  log: OAuthDeps['log'];
}

function bearerOf(headers: Record<string, string>): string | undefined {
  const v = headers['Authorization'];
  return typeof v === 'string' && v.startsWith('Bearer ') ? v.slice(7) : undefined;
}

/**
 * Runs an MCP call with the Bearer token already in `headers`. On HTTP 401 forces ONE refresh and
 * retries ONCE. On revocation (or reconnect-required) marks the tool and returns a neutral message
 * so the agent never exposes technical details to the buyer.
 */
export async function executeWithOAuthCore(
  deps: ExecuteWithOAuthDeps,
  headers: Record<string, string>
): Promise<McpExecResult> {
  const handleReconnect = async (): Promise<McpExecResult> => {
    await deps.markNeedsReconnect().catch((e) => deps.log.error(`[mcp-oauth] markNeedsReconnect failed: ${(e as Error).message}`));
    return { content: OAUTH_UNAVAILABLE_MESSAGE, isError: true };
  };

  let result = await deps.execute(headers);

  if (result.isError && /HTTP 401/.test(result.content)) {
    try {
      const fresh = await deps.getToken({ forceRefresh: true, staleAccessToken: bearerOf(headers) });
      result = await deps.execute({ ...headers, Authorization: `Bearer ${fresh}` });
    } catch (err) {
      if (err instanceof McpOAuthReconnectRequiredError) return handleReconnect();
      deps.log.error(`[mcp-oauth] Token refresh after 401 failed: ${(err as Error).message}`);
      return { content: OAUTH_UNAVAILABLE_MESSAGE, isError: true };
    }
  }

  if (isRevokedToolResult(result.content)) {
    deps.log.warn('[mcp-oauth] Provider reported a revoked session');
    return handleReconnect();
  }
  return result;
}
