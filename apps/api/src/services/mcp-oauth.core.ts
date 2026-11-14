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
  /**
   * New UUID on every connection/reconnection. Writes that belong to a session (refresh result,
   * needs_reconnect) only apply while the stored block still carries the same id, so a late write
   * of an old session never lands on a newer one. Absent in legacy blocks (treated as matching).
   */
  session_id?: string;
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
  /** User that started the flow: the authenticated completion step must be performed by the same user. */
  userId: string;
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
    /** Plain GET (no delete). */
    get(key: string): Promise<string | null>;
    /** Atomic GET + DEL. */
    getDel(key: string): Promise<string | null>;
    /** SET key value PX ms NX. Returns true when the lock was acquired. */
    setNxPx(key: string, value: string, ms: number): Promise<boolean>;
    /** Delete key only if its value equals `value` (atomic). */
    delIfEquals(key: string, value: string): Promise<void>;
  };
  /** Reads `agent_tools.config.oauth` of a tool; null when the tool or oauth block does not exist. */
  loadOAuth(toolId: string, agentId: string): Promise<StoredOAuth | null>;
  /**
   * Single atomic UPDATE merging these fields into config.oauth (never touching other config keys),
   * applied ONLY when the stored session_id equals `sessionId` (null = legacy block without id).
   * Returns false when the session changed meanwhile (nothing written).
   */
  mergeOAuth(toolId: string, agentId: string, patch: Partial<StoredOAuth>, sessionId: string | null): Promise<boolean>;
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
export const TICKET_KEY_PREFIX = 'mcp:oauth:ticket:';
export const TICKET_TTL_SECONDS = 300;
/** Must exceed the HTTP timeout (15 s) plus DB reads inside the lock, or a second process could replay a consumed refresh token. */
export const REFRESH_LOCK_TTL_MS = 60_000;
export const LOCK_WAIT_POLL_MS = 250;
export const LOCK_WAIT_MAX_MS = 20_000;
export const REFRESH_MARGIN_MS = 5 * 60 * 1000;
const STATE_PATTERN = /^[a-f0-9]{48}$/;
export const TICKET_PATTERN = /^[a-f0-9]{48}$/;

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
    userId: string;
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
    userId: input.userId,
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
    if (!p.organizationId || !p.agentId || !p.providerId || !p.codeVerifier || !p.redirectUri || !p.userId) {
      throw new McpOAuthStateError();
    }
    return {
      organizationId: p.organizationId,
      agentId: p.agentId,
      providerId: p.providerId,
      codeVerifier: p.codeVerifier,
      redirectUri: p.redirectUri,
      userId: p.userId,
    };
  } catch {
    throw new McpOAuthStateError();
  }
}

/** Reads the state WITHOUT consuming it (callback step: only to know which agent to redirect to). */
export async function peekState(deps: OAuthDeps, state: string): Promise<OAuthStatePayload | null> {
  if (typeof state !== 'string' || !STATE_PATTERN.test(state)) return null;
  try {
    const raw = await deps.kv.get(STATE_KEY_PREFIX + state);
    if (!raw) return null;
    const p = JSON.parse(deps.decrypt(raw)) as Partial<OAuthStatePayload>;
    if (!p.agentId || !p.providerId) return null;
    return p as OAuthStatePayload;
  } catch {
    return null;
  }
}

/** Single-use ticket carrying {state, code} from the public callback to the authenticated completion. */
export async function createTicket(deps: OAuthDeps, payload: { state: string; code: string }): Promise<string> {
  const ticket = deps.randomBytes(24).toString('hex');
  await deps.kv.setEx(TICKET_KEY_PREFIX + ticket, deps.encrypt(JSON.stringify(payload)), TICKET_TTL_SECONDS);
  return ticket;
}

export async function consumeTicket(deps: OAuthDeps, ticket: string): Promise<{ state: string; code: string }> {
  if (typeof ticket !== 'string' || !TICKET_PATTERN.test(ticket)) throw new McpOAuthStateError();
  let raw: string | null;
  try {
    raw = await deps.kv.getDel(TICKET_KEY_PREFIX + ticket);
  } catch {
    throw new McpOAuthStateError();
  }
  if (!raw) throw new McpOAuthStateError();
  try {
    const p = JSON.parse(deps.decrypt(raw)) as { state?: unknown; code?: unknown };
    if (typeof p.state !== 'string' || typeof p.code !== 'string' || !p.state || !p.code) throw new McpOAuthStateError();
    return { state: p.state, code: p.code };
  } catch {
    throw new McpOAuthStateError();
  }
}

export class McpOAuthForbiddenError extends Error {
  readonly code = 'FORBIDDEN';
  constructor() {
    super('OAuth completion not allowed');
    this.name = 'McpOAuthForbiddenError';
  }
}

/**
 * Authenticated completion gate: the state must belong to THIS org, agent, provider and user.
 * Consumes the ticket and the state (both single use) before comparing, so a mismatch cannot be retried.
 * Returns the state payload and the code; the caller then exchanges the code.
 */
export async function claimTicket(
  deps: OAuthDeps,
  input: { ticket: string; organizationId: string; agentId: string; providerId: string; userId: string }
): Promise<{ state: OAuthStatePayload; code: string }> {
  const t = await consumeTicket(deps, input.ticket);
  const state = await consumeState(deps, t.state);
  if (
    state.organizationId !== input.organizationId ||
    state.agentId !== input.agentId ||
    state.providerId !== input.providerId ||
    state.userId !== input.userId
  ) {
    throw new McpOAuthForbiddenError();
  }
  return { state, code: t.code };
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
    session_id: deps.randomUUID(),
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

function sessionOf(o: Pick<StoredOAuth, 'session_id'> | Partial<StoredOAuth>): string | null {
  return typeof o.session_id === 'string' && o.session_id ? o.session_id : null;
}

async function markReconnect(deps: OAuthDeps, toolId: string, agentId: string, sessionId: string | null): Promise<boolean> {
  return deps.mergeOAuth(
    toolId,
    agentId,
    { status: 'needs_reconnect', updated_at: new Date(deps.now()).toISOString() },
    sessionId
  );
}

/** Marks needs_reconnect only if the stored block is still the session `sessionId` (null = legacy). */
export async function markNeedsReconnectCore(
  deps: OAuthDeps,
  toolId: string,
  agentId: string,
  sessionId: string | null
): Promise<void> {
  if (await markReconnect(deps, toolId, agentId, sessionId)) {
    deps.log.warn(`[mcp-oauth] Tool ${toolId} marked needs_reconnect`);
  } else {
    deps.log.info(`[mcp-oauth] Tool ${toolId} was reconnected meanwhile; needs_reconnect not applied`);
  }
}

/**
 * Runs `fn` holding the per-tool refresh lock (same key as the refresh). Bounded wait; on timeout
 * throws McpOAuthTransientError without running `fn`. Used by reconnection so it never interleaves
 * with an in-flight refresh of the previous session.
 */
export async function withRefreshLockCore<T>(deps: OAuthDeps, toolId: string, fn: () => Promise<T>): Promise<T> {
  const lockKey = REFRESH_LOCK_PREFIX + toolId;
  const lockValue = deps.randomUUID();
  const deadline = deps.now() + LOCK_WAIT_MAX_MS;
  while (!(await deps.kv.setNxPx(lockKey, lockValue, REFRESH_LOCK_TTL_MS))) {
    if (deps.now() >= deadline) throw new McpOAuthTransientError('Timed out waiting for the connection lock');
    await deps.sleep(LOCK_WAIT_POLL_MS);
  }
  try {
    return await fn();
  } finally {
    await deps.kv.delIfEquals(lockKey, lockValue).catch(() => {});
  }
}

export interface AccessTokenWithSession {
  accessToken: string;
  /** session_id of the stored block the token belongs to (null = legacy block). */
  sessionId: string | null;
}

/** Returns the stored token if it can be used for this call (fresh, and not the rejected one when forcing). */
function usableStored(deps: OAuthDeps, o: StoredOAuth, input: GetTokenInput): AccessTokenWithSession | null {
  if (o.status === 'needs_reconnect') throw new McpOAuthReconnectRequiredError();
  if (!isFresh(deps, o)) return null;
  const token = deps.decrypt(o.access_token_encrypted);
  if (input.forceRefresh) {
    // Only reuse a token that differs from the rejected one (someone else refreshed meanwhile).
    if (!input.staleAccessToken || token === input.staleAccessToken) return null;
  }
  return { accessToken: token, sessionId: sessionOf(o) };
}

export async function getValidAccessTokenCore(deps: OAuthDeps, input: GetTokenInput): Promise<string> {
  return (await getValidAccessTokenWithSessionCore(deps, input)).accessToken;
}

export async function getValidAccessTokenWithSessionCore(
  deps: OAuthDeps,
  input: GetTokenInput
): Promise<AccessTokenWithSession> {
  const { toolId, agentId } = input;
  const initial = await deps.loadOAuth(toolId, agentId);
  if (!initial) throw new McpOAuthReconnectRequiredError('No OAuth credentials stored for this tool');

  const direct = usableStored(deps, initial, input);
  if (direct) return direct;

  // Resolve endpoints BEFORE taking the lock (settings/profile lookups must not eat lock time).
  const endpoints = await input.getEndpoints();

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

    const sessionId = sessionOf(stored);
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
        // A 2xx means the provider most likely already rotated (consumed) the refresh token. Retrying
        // with the stored one would replay it and revoke the session: require a reconnect instead.
        deps.log.error(`[mcp-oauth] Refresh returned an unreadable 2xx token response for tool ${toolId}; reconnect required`);
        await markReconnect(deps, toolId, agentId, sessionId);
        throw new McpOAuthReconnectRequiredError();
      }
      const nowIso = new Date(deps.now()).toISOString();
      // New access + NEW refresh token + expiry in a single atomic UPDATE, only on the same session.
      const written = await deps.mergeOAuth(
        toolId,
        agentId,
        {
          access_token_encrypted: deps.encrypt(tokens.accessToken),
          refresh_token_encrypted: deps.encrypt(tokens.refreshToken),
          expires_at: new Date(deps.now() + tokens.expiresIn * 1000).toISOString(),
          status: 'connected',
          updated_at: nowIso,
        },
        sessionId
      );
      if (!written) {
        // The tool was reconnected (new session) while we refreshed: never use the old account's token.
        deps.log.warn(`[mcp-oauth] Tool ${toolId} was reconnected during refresh; refreshed token discarded`);
        throw new McpOAuthTransientError('The connection changed during refresh');
      }
      deps.log.info(`[mcp-oauth] Refreshed access token for tool ${toolId}`);
      return { accessToken: tokens.accessToken, sessionId };
    }

    if (res.status === 400 || res.status === 401) {
      deps.log.warn(
        `[mcp-oauth] Refresh rejected for tool ${toolId} (HTTP ${res.status}, error=${oauthErrorCode(res.body)}); reconnect required`
      );
      await markReconnect(deps, toolId, agentId, sessionId);
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

/** Neutral text for the LLM (no technical detail, no promises). Treatment of the buyer is up to the template. */
export function oauthUnavailableMessage(providerName: string): string {
  return `No pude consultar ${providerName} en este momento. Intenta de nuevo más tarde.`;
}

// ── Tool execution wrapper (401 retry + revocation handling) ─────────────────

export interface McpExecResult {
  content: string;
  isError: boolean;
}

export interface ExecuteWithOAuthDeps {
  execute: (headers: Record<string, string>) => Promise<McpExecResult>;
  getToken: (opts: { forceRefresh: boolean; staleAccessToken?: string }) => Promise<AccessTokenWithSession>;
  /** Marks needs_reconnect only for the given session (the one whose token was rejected/revoked). */
  markNeedsReconnect: (sessionId: string | null) => Promise<void>;
  /** Provider display name used in the neutral message. */
  providerName: string;
  log: OAuthDeps['log'];
}

function bearerOf(headers: Record<string, string>): string | undefined {
  const v = headers['Authorization'];
  return typeof v === 'string' && v.startsWith('Bearer ') ? v.slice(7) : undefined;
}

/**
 * Runs an MCP call with the Bearer token already in `headers`. On HTTP 401 forces ONE refresh and
 * retries ONCE. On revocation (isError result with the revoked text) or reconnect-required marks the
 * tool and returns a neutral message so the agent never exposes technical details to the buyer.
 */
export async function executeWithOAuthCore(
  deps: ExecuteWithOAuthDeps,
  headers: Record<string, string>,
  /** Session of the Bearer already in `headers` (null = legacy block). */
  sessionId: string | null
): Promise<McpExecResult> {
  let currentSession = sessionId;
  const neutral = (): McpExecResult => ({ content: oauthUnavailableMessage(deps.providerName), isError: true });
  const handleReconnect = async (): Promise<McpExecResult> => {
    await deps
      .markNeedsReconnect(currentSession)
      .catch((e) => deps.log.error(`[mcp-oauth] markNeedsReconnect failed: ${(e as Error).message}`));
    return neutral();
  };

  let result = await deps.execute(headers);

  if (result.isError && /HTTP 401/.test(result.content)) {
    try {
      const fresh = await deps.getToken({ forceRefresh: true, staleAccessToken: bearerOf(headers) });
      currentSession = fresh.sessionId;
      result = await deps.execute({ ...headers, Authorization: `Bearer ${fresh.accessToken}` });
    } catch (err) {
      if (err instanceof McpOAuthReconnectRequiredError) return handleReconnect();
      deps.log.error(`[mcp-oauth] Token refresh after 401 failed: ${(err as Error).message}`);
      return neutral();
    }
  }

  // Only an error result can mean a revoked session: a successful result may legitimately contain the text.
  if (result.isError && isRevokedToolResult(result.content)) {
    deps.log.warn('[mcp-oauth] Provider reported a revoked session');
    return handleReconnect();
  }
  return result;
}

// ── Default tool selection (first connection) ────────────────────────────────

/**
 * selected_tools to store after an OAuth connection, or null to leave the stored selection untouched.
 * - Reconnection: null (the user's selection is kept as is).
 * - First connection: the profile's default_selected_tools ∩ discovered tools; all discovered when
 *   the profile has no default (NULL), preserving the behaviour of the other providers.
 */
export function selectedToolsAfterConnect(input: {
  isReconnect: boolean;
  discovered: readonly string[];
  profileDefaults: readonly string[] | null;
}): string[] | null {
  if (input.isReconnect) return null;
  if (input.profileDefaults == null) return [...input.discovered];
  const allowed = new Set(input.profileDefaults);
  return input.discovered.filter((name) => allowed.has(name));
}

// ── Outbound header policy ───────────────────────────────────────────────────

/**
 * OAuth providers without webhook events (e.g. Dropi) need none of GenSmart's own headers
 * (X-Webhook-Secret, X-Agent-ID, X-Session-ID): they are not sent to them.
 */
export function profileOmitsGenSmartHeaders(
  profile: { oauth_config: unknown; supported_events: readonly string[] } | null | undefined
): boolean {
  return !!profile && profile.oauth_config != null && profile.supported_events.length === 0;
}

// ── Previous-session revocation on reconnection ──────────────────────────────

/**
 * `sub` claim of a JWT, decoded WITHOUT verifying the signature. Only used to compare whether two
 * tokens belong to the same provider account; NEVER for authorization. Never throws, never logs.
 */
export function jwtSubject(token: string): string | null {
  try {
    if (typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3 || !parts[1]) return null;
    const json = Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    const payload: unknown = JSON.parse(json);
    if (typeof payload !== 'object' || payload === null) return null;
    const sub = (payload as Record<string, unknown>)['sub'];
    return typeof sub === 'string' && sub.length > 0 ? sub : null;
  } catch {
    return null;
  }
}

/**
 * Reconnection: revokes the previous session ONLY when both account subjects are readable and
 * differ. Same account (the provider already invalidated the old session; revoking could kill the
 * new one) or an unreadable subject → no revocation. Logs carry no account ids nor tokens.
 */
export async function revokePreviousIfAccountChangedCore(
  deps: {
    decrypt: (text: string) => string;
    revoke: (previous: Partial<StoredOAuth>) => Promise<void>;
    log: OAuthDeps['log'];
  },
  previous: Partial<StoredOAuth> | null,
  newAccessToken: string
): Promise<void> {
  if (!previous) return;
  let prevSub: string | null = null;
  try {
    prevSub = previous.access_token_encrypted ? jwtSubject(deps.decrypt(previous.access_token_encrypted)) : null;
  } catch {
    prevSub = null;
  }
  const newSub = jwtSubject(newAccessToken);
  if (!prevSub || !newSub || prevSub === newSub) {
    deps.log.info('[mcp-oauth] Previous session not revoked (same account or unknown)');
    return;
  }
  await deps.revoke(previous);
}
