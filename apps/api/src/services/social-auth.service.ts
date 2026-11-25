import crypto from 'crypto';
import { z } from 'zod';
import { userLanguageSchema } from '@gensmart/shared';
import bcrypt from 'bcryptjs';
import { query, getClient } from '../config/database';
import { redis } from '../config/redis';
import { sendAccountLinkedEmail, sendWelcomeEmail } from '../config/email';
import { AppError } from '../middleware/errorHandler';
import {
  applyPromoOnVerification,
  completeSignIn,
  createAccount,
  type AuthTokens,
  type TwoFactorRequired,
  type UserRow,
} from './auth.service';
import type { OAuthIdentity, OAuthProvider, OAuthProviderId } from './oauth/types';

/**
 * Ingreso y registro con proveedores externos (web-38), igual para todos los proveedores:
 * estado de un solo uso con PKCE, vincular por `sub` o por correo, entrar (con el 2FA de siempre)
 * o dejar un registro pendiente. El proveedor solo arma la URL y verifica el ID token.
 */

export type OAuthIntent = 'login' | 'register';
export type OAuthLang = 'es' | 'en';

/** Lo que se guarda al iniciar y se recupera (una sola vez) al volver del proveedor. */
export interface OAuthStartState {
  provider: OAuthProviderId;
  nonce: string;
  codeVerifier: string;
  intent: OAuthIntent;
  from: string;
  lang: OAuthLang;
  plan?: string;
  code?: string;
  ref?: string;
}

/** Registro pendiente: la persona volvió del proveedor sin cuenta y tiene que completar sus datos. */
export interface PendingSignup {
  provider: OAuthProviderId;
  sub: string;
  email: string;
  name: string;
  intent: OAuthIntent;
  from: string;
  lang: OAuthLang;
  plan?: string;
  code?: string;
  ref?: string;
}

/** Lo mínimo de Redis que usa este servicio (permite un doble en los tests). */
export interface KeyValueStore {
  set(key: string, value: string, mode: 'EX', seconds: number): Promise<unknown>;
  get(key: string): Promise<string | null>;
  getdel(key: string): Promise<string | null>;
  del(key: string): Promise<unknown>;
}

const STATE_TTL_SECONDS = 10 * 60;
const HANDOFF_TTL_SECONDS = 5 * 60;
const SIGNUP_TTL_SECONDS = 15 * 60;

const stateKey = (state: string) => `oauth:state:${state}`;
const handoffKey = (handle: string) => `oauth:2fa-handoff:${handle}`;
const signupKey = (token: string) => `oauth:signup:${token}`;

function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

/** Desafío PKCE S256 de un verificador (RFC 7636). */
export function pkceChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

/** `from` solo acepta rutas internas: la misma regla que la web (`safeFrom`). */
export function safeFrom(raw: unknown): string {
  return typeof raw === 'string' && /^\/(?!\/|\\)[^\s]*$/.test(raw) && raw.length <= 512 ? raw : '/dashboard';
}

/** Errores que la web sabe mostrar (`?oauth_error=`), sin detalles técnicos. */
export type OAuthErrorCode = 'cancelled' | 'expired' | 'unverified' | 'conflict' | 'unavailable' | 'failed';

export class OAuthFlowError extends Error {
  constructor(public readonly code: OAuthErrorCode, message: string) {
    super(message);
    this.name = 'OAuthFlowError';
  }
}

// ---------- inicio ----------

export async function startOAuth(
  provider: OAuthProvider,
  input: Omit<OAuthStartState, 'provider' | 'nonce' | 'codeVerifier'>,
  store: KeyValueStore = redis
): Promise<{ url: string; state: string }> {
  if (!provider.isConfigured()) throw new OAuthFlowError('unavailable', `${provider.id} is not configured`);
  const state = randomToken();
  const nonce = randomToken();
  const codeVerifier = randomToken(48); // 64 caracteres, dentro de 43–128
  const saved: OAuthStartState = { ...input, provider: provider.id, nonce, codeVerifier };
  await store.set(stateKey(state), JSON.stringify(saved), 'EX', STATE_TTL_SECONDS);
  const url = provider.buildAuthUrl({ state, nonce, codeChallenge: pkceChallenge(codeVerifier), lang: input.lang });
  return { url, state };
}

/**
 * Recupera el estado del inicio y lo borra en la misma operación (GETDEL): un `state` sirve una
 * sola vez, aunque lleguen dos retornos a la vez. Vencido, reusado o de otro proveedor: null.
 */
export async function consumeOAuthState(
  state: string,
  providerId: OAuthProviderId,
  store: KeyValueStore = redis
): Promise<OAuthStartState | null> {
  if (!state || state.length > 200) return null;
  const raw = await store.getdel(stateKey(state));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as OAuthStartState;
    return parsed.provider === providerId ? parsed : null;
  } catch {
    return null;
  }
}

// ---------- retorno ----------

export type OAuthCallbackOutcome =
  | { kind: 'session'; tokens: AuthTokens; from: string; lang: OAuthLang }
  | { kind: 'twoFactor'; handle: string; from: string; lang: OAuthLang }
  | { kind: 'signup'; token: string; noAccount: boolean; lang: OAuthLang };

interface LinkableUserRow extends UserRow {
  google_sub: string | null;
}

const USER_COLUMNS = `u.id, u.email, u.name, u.role, u.organization_id, u.password_hash,
  u.totp_enabled, u.totp_secret_encrypted, u.last_login_at, u.language,
  u.is_super_admin, u.email_verified, u.google_sub`;

/** Columna del `sub` de cada proveedor. Un proveedor nuevo suma su columna (migración aditiva). */
const SUB_COLUMN: Record<OAuthProviderId, { sub: string; linkedAt: string }> = {
  google: { sub: 'google_sub', linkedAt: 'google_linked_at' },
};

/** Política de vínculo por correo (se reporta en el reporte de web-38). */
export type LinkDecision =
  | { action: 'signin' }
  | { action: 'link'; markVerified: boolean; resetPassword: boolean; notify: boolean }
  | { action: 'reject' };

/**
 * Qué hacer cuando existe un usuario con ese correo:
 * - ya vinculado a este `sub`: entra;
 * - vinculado a OTRO `sub` del mismo proveedor: se rechaza (no se pisa un vínculo);
 * - correo verificado: se vincula, entra y se avisa por correo;
 * - correo sin verificar: se vincula y se marca verificado (el proveedor acaba de verificarlo). Su
 *   contraseña se reemplaza por una aleatoria: quien creó esa cuenta sin verificarla pudo no ser el
 *   dueño del correo, y no debe poder entrar con la contraseña que eligió. Si la quiere, usa
 *   "Olvidé mi contraseña".
 */
export function decideLink(user: { email_verified: boolean; linkedSub: string | null }, sub: string): LinkDecision {
  if (user.linkedSub === sub) return { action: 'signin' };
  if (user.linkedSub) return { action: 'reject' };
  if (user.email_verified) return { action: 'link', markVerified: false, resetPassword: false, notify: true };
  return { action: 'link', markVerified: true, resetPassword: true, notify: false };
}

async function randomPasswordHash(): Promise<string> {
  return bcrypt.hash(randomToken(32), 12);
}

/** Vincula el `sub` al usuario y aplica la decisión. Devuelve el usuario actualizado. */
async function linkUser(
  provider: OAuthProvider,
  user: LinkableUserRow,
  identity: OAuthIdentity,
  decision: Extract<LinkDecision, { action: 'link' }>
): Promise<LinkableUserRow> {
  const cols = SUB_COLUMN[provider.id];
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const sets = [`${cols.sub} = $2`, `${cols.linkedAt} = NOW()`, 'updated_at = NOW()'];
    const params: unknown[] = [user.id, identity.sub];
    if (decision.markVerified) sets.push('email_verified = TRUE');
    if (decision.resetPassword) {
      params.push(await randomPasswordHash());
      sets.push(`password_hash = $${params.length}`, 'password_set = FALSE');
    }
    // `${cols.sub} IS NULL`: si otro retorno lo vinculó entre tanto, no se pisa
    const updated = await client.query<LinkableUserRow>(
      `UPDATE users u SET ${sets.join(', ')} WHERE u.id = $1 AND u.${cols.sub} IS NULL RETURNING ${USER_COLUMNS}`,
      params
    );
    const row = updated.rows[0];
    if (!row) throw new OAuthFlowError('conflict', 'Account was linked concurrently');

    if (decision.markVerified) {
      // Lo que hace la verificación del correo: los enlaces pendientes quedan usados y se aplica la
      // promoción elegida al registrarse (o la prueba por defecto)
      const pending = await client.query<{ promo_code: string | null }>(
        `UPDATE email_verifications SET used = TRUE WHERE user_id = $1 AND used = FALSE
         RETURNING promo_code`,
        [user.id]
      );
      const promo = pending.rows.find((r) => r.promo_code)?.promo_code ?? null;
      await applyPromoOnVerification(client, row.organization_id, promo);
    }
    if (decision.resetPassword) {
      // Ninguna sesión abierta con la contraseña anterior sigue viva
      await client.query('UPDATE refresh_tokens SET used = TRUE WHERE user_id = $1 AND used = FALSE', [user.id]);
    }
    await client.query('COMMIT');

    if (decision.notify) {
      sendAccountLinkedEmail({ name: row.name, email: row.email }, provider.label).catch((err) =>
        console.error('[Email] Failed to send account-linked email:', err instanceof Error ? err.message : 'unknown')
      );
    }
    if (decision.markVerified) {
      sendWelcomeEmail({ name: row.name, email: row.email }).catch((err) =>
        console.error('[Email] Failed to send welcome email:', err instanceof Error ? err.message : 'unknown')
      );
    }
    return row;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

async function sessionOrTwoFactor(
  user: UserRow,
  from: string,
  lang: OAuthLang,
  store: KeyValueStore
): Promise<OAuthCallbackOutcome> {
  const result: AuthTokens | TwoFactorRequired = await completeSignIn(user);
  if ('requires2FA' in result) {
    // El tempToken (JWT de 5 min) no viaja en la URL: se guarda tras un identificador de un solo uso
    const handle = randomToken();
    await store.set(handoffKey(handle), result.tempToken, 'EX', HANDOFF_TTL_SECONDS);
    return { kind: 'twoFactor', handle, from, lang };
  }
  return { kind: 'session', tokens: result, from, lang };
}

/** Resuelve el retorno ya verificado: entrar, vincular y entrar, o dejar un registro pendiente. */
export async function resolveOAuthIdentity(
  provider: OAuthProvider,
  identity: OAuthIdentity,
  state: OAuthStartState,
  store: KeyValueStore = redis
): Promise<OAuthCallbackOutcome> {
  if (!identity.emailVerified) throw new OAuthFlowError('unverified', 'Provider email is not verified');
  const cols = SUB_COLUMN[provider.id];

  const bySub = await query<LinkableUserRow>(
    `SELECT ${USER_COLUMNS} FROM users u WHERE u.${cols.sub} = $1`,
    [identity.sub]
  );
  if (bySub.rows[0]) return sessionOrTwoFactor(bySub.rows[0], state.from, state.lang, store);

  const byEmail = await query<LinkableUserRow>(`SELECT ${USER_COLUMNS} FROM users u WHERE u.email = $1`, [identity.email]);
  const existing = byEmail.rows[0];
  if (existing) {
    const decision = decideLink({ email_verified: existing.email_verified, linkedSub: existing.google_sub }, identity.sub);
    if (decision.action === 'reject') throw new OAuthFlowError('conflict', 'Email is linked to another provider account');
    const user = decision.action === 'link' ? await linkUser(provider, existing, identity, decision) : existing;
    return sessionOrTwoFactor(user, state.from, state.lang, store);
  }

  const token = randomToken();
  const pending: PendingSignup = {
    provider: provider.id,
    sub: identity.sub,
    email: identity.email,
    name: identity.name,
    intent: state.intent,
    from: state.from,
    lang: state.lang,
    plan: state.plan,
    code: state.code,
    ref: state.ref,
  };
  await store.set(signupKey(token), JSON.stringify(pending), 'EX', SIGNUP_TTL_SECONDS);
  return { kind: 'signup', token, noAccount: state.intent === 'login', lang: state.lang };
}

// ---------- 2FA ----------

/** Cambia el identificador del retorno por el tempToken del 2FA (una sola vez). */
export async function consumeTwoFactorHandoff(handle: string, store: KeyValueStore = redis): Promise<string> {
  const tempToken = handle.length <= 200 ? await store.getdel(handoffKey(handle)) : null;
  if (!tempToken) throw new AppError(401, 'Invalid or expired token', 'INVALID_TOKEN');
  return tempToken;
}

// ---------- registro pendiente ----------

async function readPendingSignup(token: string, store: KeyValueStore): Promise<PendingSignup> {
  const raw = token.length <= 200 ? await store.get(signupKey(token)) : null;
  if (!raw) throw new AppError(410, 'Signup link expired', 'SIGNUP_EXPIRED');
  return JSON.parse(raw) as PendingSignup;
}

/** Lo que muestra `/register/google`: sin el `sub`. */
export async function getPendingSignup(
  token: string,
  store: KeyValueStore = redis
): Promise<Pick<PendingSignup, 'email' | 'name' | 'plan' | 'code' | 'lang' | 'intent'>> {
  const p = await readPendingSignup(token, store);
  return { email: p.email, name: p.name, plan: p.plan, code: p.code, lang: p.lang, intent: p.intent };
}

/** Cuerpo de POST /api/auth/oauth/complete. */
export const oauthCompleteSchema = z.object({
  token: z.string().min(1).max(200),
  name: z.string().trim().min(2).max(100),
  organizationName: z.string().trim().min(2).max(255),
  // Igual que registerSchema: sin aceptar los Términos no se crea la cuenta
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'You must accept the Terms and the Privacy Policy' }) }),
  promoCode: z.string().trim().max(100).optional(),
  language: userLanguageSchema.optional(),
});

export interface CompleteSignupInput {
  token: string;
  name: string;
  organizationName: string;
  acceptTerms: true;
  /** Código promocional del formulario (puede quitarse el que llegó en el enlace). */
  promoCode?: string;
  /** Idioma de la pantalla al enviar. */
  language?: OAuthLang;
}

/**
 * Crea la cuenta con la misma lógica del registro (createAccount), ya verificada: sin correo de
 * verificación, con la promoción aplicada al crearla. El token se borra solo si la cuenta se creó,
 * para que un error del formulario (nombre de negocio tomado) se pueda corregir.
 */
export async function completeOAuthSignup(
  input: CompleteSignupInput,
  store: KeyValueStore = redis
): Promise<{ tokens: AuthTokens; from: string; promoApplied: boolean }> {
  const pending = await readPendingSignup(input.token, store);
  const created = await createAccount({
    email: pending.email,
    name: input.name,
    organizationName: input.organizationName,
    passwordHash: await randomPasswordHash(),
    passwordSet: false,
    emailVerified: true,
    promoCode: input.promoCode,
    plan: pending.plan,
    ref: pending.ref,
    language: input.language ?? pending.lang,
    googleSub: pending.provider === 'google' ? pending.sub : undefined,
  });
  await store.del(signupKey(input.token)).catch(() => undefined);

  sendWelcomeEmail({ name: created.user.name, email: created.user.email }).catch((err) =>
    console.error('[Email] Failed to send welcome email:', err instanceof Error ? err.message : 'unknown')
  );

  const result = await completeSignIn(created.user);
  if ('requires2FA' in result) {
    // Una cuenta recién creada no tiene 2FA
    throw new AppError(500, 'Unexpected 2FA on a new account', 'INTERNAL');
  }
  return { tokens: result, from: pending.from, promoApplied: created.promoTrialApplied };
}
