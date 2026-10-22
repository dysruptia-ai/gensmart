import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import { query, getClient } from '../config/database';
import { redis } from '../config/redis';
import { encrypt, decrypt } from '../config/encryption';
import {
  generateAccessToken,
  generateRefreshToken,
  generateTempToken,
  verifyTempToken,
  verifyRefreshToken,
} from '../config/jwt';
import {
  sendWelcomeEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendOrgAccessEmail,
} from '../config/email';
import { AppError } from '../middleware/errorHandler';
import { pickSessionMembership } from './access-rules';
import {
  ATTEMPT_LIMITS,
  buildAttemptKey,
  clearFailures,
  failureCount,
  guardPasswordCheck,
  isBlocked,
  recordFailure,
} from './attempt-limiter';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    orgId: string;
    orgName: string;
    totpEnabled: boolean;
    language: string;
    onboardingCompleted: boolean;
    onboardingStep: number;
    editorTourCompleted: boolean;
    isSuperAdmin: boolean;
  };
}

export interface TwoFactorRequired {
  requires2FA: true;
  tempToken: string;
}

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  organization_id: string;
  password_hash: string;
  totp_enabled: boolean;
  totp_secret_encrypted: string | null;
  last_login_at: string | null;
  language: string;
  onboarding_completed: boolean;
  onboarding_step: number;
  editor_tour_completed: boolean;
  is_super_admin: boolean;
  email_verified: boolean;
}

interface OrgRow {
  id: string;
  name: string;
}

interface RefreshTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  used: boolean;
}

interface BackupCodeRow {
  id: string;
  code_hash: string;
  used: boolean;
}

/**
 * Dummy bcrypt hash (cost 12, the same as real users) of a random value nobody knows. It is NOT a
 * credential: login compares against it when the email does not exist, so unknown emails take as long
 * to answer as known ones.
 */
const DUMMY_PASSWORD_HASH = '$2a$12$YLq4uYJCenDMzoRwIB2mv.Sl67J5yF68oLfQs3TA2eQawtz2rdVuK';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function generateRandomCode(length = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

/**
 * Organization and role of a new session come from user_organizations (not from the users row,
 * which can be stale after a removal): the primary organization when the user is still a member,
 * otherwise their oldest membership.
 */
async function resolveSessionMembership(user: UserRow): Promise<{ organization_id: string; role: string }> {
  const result = await query<{ organization_id: string; role: string; created_at: string }>(
    'SELECT organization_id, role, created_at FROM user_organizations WHERE user_id = $1',
    [user.id]
  );
  const membership = pickSessionMembership(result.rows, user.organization_id);
  if (!membership) {
    throw new AppError(403, 'User is not a member of any organization', 'NOT_A_MEMBER');
  }
  return { organization_id: membership.organization_id, role: membership.role };
}

async function buildAuthTokens(user: UserRow, org: OrgRow): Promise<AuthTokens> {
  // Note: user.totp_enabled is included in the returned user object so the frontend
  // can correctly show the 2FA status without an extra API call
  const tokenId = crypto.randomUUID();
  const accessToken = generateAccessToken({
    userId: user.id,
    orgId: user.organization_id,
    role: user.role,
    email: user.email,
    isSuperAdmin: user.is_super_admin || false,
  });

  const refreshTokenRaw = generateRefreshToken({
    userId: user.id,
    orgId: user.organization_id,
    tokenId,
  });

  const tokenHash = hashToken(refreshTokenRaw);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await query(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
     VALUES ($1, $2, $3, $4, NOW())`,
    [tokenId, user.id, tokenHash, expiresAt.toISOString()]
  );

  return {
    accessToken,
    refreshToken: refreshTokenRaw,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      orgId: user.organization_id,
      orgName: org.name,
      totpEnabled: user.totp_enabled,
      language: user.language ?? 'en',
      onboardingCompleted: user.onboarding_completed ?? false,
      onboardingStep: user.onboarding_step ?? 0,
      editorTourCompleted: user.editor_tour_completed ?? false,
      isSuperAdmin: user.is_super_admin || false,
    },
  };
}

interface PromoRow {
  id: string;
  plan: string;
  duration_days: number;
  max_uses: number | null;
  used_count: number;
  is_active: boolean;
  expires_at: string | null;
}

/** The promo code row when it is active, not exhausted and not expired; otherwise null. */
async function findValidPromo(
  client: Awaited<ReturnType<typeof getClient>>,
  code: string
): Promise<PromoRow | null> {
  const promoResult = await client.query<PromoRow>(
    `SELECT id, plan, duration_days, max_uses, used_count, is_active, expires_at
     FROM promo_codes WHERE code = $1`,
    [code.toUpperCase().trim()]
  );
  const promo = promoResult.rows[0];
  if (
    promo && promo.is_active
    && (promo.max_uses === null || promo.used_count < promo.max_uses)
    && (!promo.expires_at || new Date(promo.expires_at) > new Date())
  ) {
    return promo;
  }
  return null;
}

export interface RegisterResult {
  email: string;
  name: string;
  /** True when the promo code was valid at registration; the trial itself is applied on email verification */
  promoApplied: boolean;
}

export async function register(input: {
  email: string;
  password: string;
  name: string;
  organizationName: string;
  promoCode?: string;
}): Promise<RegisterResult> {
  const existing = await query<{ id: string }>(
    'SELECT id FROM users WHERE email = $1',
    [input.email.toLowerCase()]
  );
  if (existing.rows.length > 0) {
    throw new AppError(409, 'Email already registered', 'EMAIL_TAKEN');
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const client = await getClient();
  let promoApplied = false;

  try {
    await client.query('BEGIN');

    const orgSlug = slugify(input.organizationName);
    const orgResult = await client.query<OrgRow>(
      `INSERT INTO organizations (id, name, slug, plan, subscription_status, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, 'free', 'active', NOW(), NOW())
       RETURNING id, name`,
      [input.organizationName, orgSlug]
    );
    const org = orgResult.rows[0];

    const userResult = await client.query<UserRow>(
      `INSERT INTO users (id, organization_id, email, name, password_hash, role, email_verified, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'owner', false, NOW(), NOW())
       RETURNING id, email, name, role, organization_id, password_hash, totp_enabled, totp_secret_encrypted, last_login_at, language, is_super_admin`,
      [org.id, input.email.toLowerCase(), input.name, passwordHash]
    );
    const user = userResult.rows[0];

    await client.query(
      `INSERT INTO user_organizations (user_id, organization_id, role, created_at)
       VALUES ($1, $2, 'owner', NOW())
       ON CONFLICT (user_id, organization_id) DO NOTHING`,
      [user.id, org.id]
    );

    // Promo code: only checked here. It is applied when the email is verified (consumeEmailVerificationToken),
    // so an account that never confirms cannot consume a code's limited uses.
    if (input.promoCode) {
      promoApplied = (await findValidPromo(client, input.promoCode)) !== null;
      // If code is invalid, silently ignore — user still registers on Free plan
    }

    await client.query('COMMIT');

    // Ask the address owner to confirm before sending anything else (the welcome email goes out on
    // confirmation). Async, don't block registration.
    generateEmailVerificationToken(user.id, promoApplied ? input.promoCode : undefined)
      .then(token => sendVerificationEmail({ name: user.name, email: user.email }, token))
      .catch(err => console.error('[Email] Failed to send verification email:', err));

    // Create Stripe customer async (don't block registration)
    import('../services/stripe.service').then(({ createCustomer }) =>
      createCustomer(org.id, input.email.toLowerCase(), input.name).catch(err =>
        console.error('[Stripe] Failed to create customer on register:', err)
      )
    ).catch(() => {/* ignore import error */});

    return { email: user.email, name: user.name, promoApplied };
  } catch (err) {
    await client.query('ROLLBACK');
    // Handle unique constraint violation on org slug
    if (err && typeof err === 'object' && 'code' in err && (err as Record<string, unknown>).code === '23505') {
      throw new AppError(409, 'Organization name already taken. Please choose a different name.', 'ORG_SLUG_TAKEN');
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function login(input: {
  email: string;
  password: string;
  ip?: string;
}): Promise<AuthTokens | TwoFactorRequired> {
  // Failed-login counters: per (email + IP) and per email. They are checked BEFORE the bcrypt
  // comparison; if Redis is down the login is allowed (a warning is logged, never the email).
  const emailLower = input.email.toLowerCase();
  const pairKey = buildAttemptKey(['login', emailLower, input.ip ?? 'unknown']);
  const emailKey = buildAttemptKey(['login-email', emailLower]);
  try {
    const [pairCount, emailCount] = await Promise.all([failureCount(pairKey), failureCount(emailKey)]);
    if (
      isBlocked(pairCount, ATTEMPT_LIMITS.loginPerEmailAndIp.max) ||
      isBlocked(emailCount, ATTEMPT_LIMITS.loginPerEmail.max)
    ) {
      throw new AppError(429, 'Too many attempts, please try again later', 'TOO_MANY_ATTEMPTS');
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    console.warn('[auth] Login attempt limiter unavailable (Redis error): login allowed');
  }
  const recordLoginFailure = async (): Promise<void> => {
    try {
      await Promise.all([
        recordFailure(pairKey, ATTEMPT_LIMITS.loginPerEmailAndIp.windowSeconds),
        recordFailure(emailKey, ATTEMPT_LIMITS.loginPerEmail.windowSeconds),
      ]);
    } catch {
      console.warn('[auth] Could not record a failed login (Redis error)');
    }
  };

  const result = await query<UserRow>(
    `SELECT u.id, u.email, u.name, u.role, u.organization_id, u.password_hash,
            u.totp_enabled, u.totp_secret_encrypted, u.last_login_at, u.language,
            u.onboarding_completed, u.onboarding_step, u.editor_tour_completed, u.is_super_admin,
            u.email_verified
     FROM users u
     WHERE u.email = $1`,
    [input.email.toLowerCase()]
  );

  const user = result.rows[0];
  if (!user) {
    await bcrypt.compare(input.password, DUMMY_PASSWORD_HASH); // result ignored: only equalizes timing
    await recordLoginFailure();
    throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const passwordMatch = await bcrypt.compare(input.password, user.password_hash);
  if (!passwordMatch) {
    await recordLoginFailure();
    throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  }
  await clearFailures(pairKey).catch(() => undefined);

  if (!user.email_verified) {
    throw new AppError(403, 'Please verify your email before logging in', 'EMAIL_NOT_VERIFIED');
  }

  if (user.totp_enabled) {
    const tempToken = generateTempToken({ userId: user.id, purpose: '2fa' });
    return { requires2FA: true, tempToken };
  }

  const membership = await resolveSessionMembership(user);
  const sessionUser: UserRow = { ...user, organization_id: membership.organization_id, role: membership.role };
  const orgResult = await query<OrgRow>(
    'SELECT id, name FROM organizations WHERE id = $1',
    [sessionUser.organization_id]
  );
  const org = orgResult.rows[0];

  await query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

  return buildAuthTokens(sessionUser, org);
}

export async function verify2FA(input: {
  tempToken: string;
  code: string;
}): Promise<AuthTokens> {
  let payload: { userId: string; orgId?: string };
  try {
    payload = verifyTempToken(input.tempToken);
  } catch {
    throw new AppError(401, 'Invalid or expired token', 'INVALID_TOKEN');
  }

  // Wrong-code limiter per user. It FAILS CLOSED: without Redis there is no way to bound the guesses.
  const twoFaKey = buildAttemptKey(['2fa', payload.userId]);
  try {
    if (isBlocked(await failureCount(twoFaKey), ATTEMPT_LIMITS.twoFactorPerUser.max)) {
      throw new AppError(429, 'Too many attempts, please try again later', 'TOO_MANY_ATTEMPTS');
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    console.warn('[auth] 2FA attempt limiter unavailable (Redis error): verification refused');
    throw new AppError(503, 'Service temporarily unavailable', 'RATE_LIMIT_UNAVAILABLE');
  }

  const result = await query<UserRow>(
    `SELECT u.id, u.email, u.name, u.role, u.organization_id, u.password_hash,
            u.totp_enabled, u.totp_secret_encrypted, u.last_login_at, u.language,
            u.onboarding_completed, u.onboarding_step, u.editor_tour_completed, u.is_super_admin
     FROM users u WHERE u.id = $1`,
    [payload.userId]
  );
  const user = result.rows[0];
  if (!user || !user.totp_enabled || !user.totp_secret_encrypted) {
    throw new AppError(401, 'Invalid token', 'INVALID_TOKEN');
  }

  const secret = decrypt(user.totp_secret_encrypted);
  const isValid = speakeasy.totp.verify({ secret, token: input.code, encoding: 'base32', window: 1 });

  if (!isValid) {
    // Try backup codes
    const backupCodes = await query<BackupCodeRow>(
      'SELECT id, code_hash, used FROM backup_codes WHERE user_id = $1 AND used = false',
      [user.id]
    );
    const codeHash = hashToken(input.code.toUpperCase());
    const matchingCode = backupCodes.rows.find(bc => bc.code_hash === codeHash);

    if (!matchingCode) {
      await recordFailure(twoFaKey, ATTEMPT_LIMITS.twoFactorPerUser.windowSeconds).catch(() => undefined);
      throw new AppError(401, 'Invalid 2FA code', 'INVALID_2FA_CODE');
    }

    await query('UPDATE backup_codes SET used = true, used_at = NOW() WHERE id = $1', [matchingCode.id]);
  }
  await clearFailures(twoFaKey).catch(() => undefined);

  // A temporary token issued by an organization access link targets that organization
  let membership: { organization_id: string; role: string };
  if (payload.orgId) {
    const targetMembership = await query<{ role: string }>(
      'SELECT role FROM user_organizations WHERE user_id = $1 AND organization_id = $2',
      [user.id, payload.orgId]
    );
    if (!targetMembership.rows[0]) {
      throw new AppError(403, 'User is not a member of this organization', 'NOT_A_MEMBER');
    }
    membership = { organization_id: payload.orgId, role: targetMembership.rows[0].role };
  } else {
    membership = await resolveSessionMembership(user);
  }
  const sessionUser: UserRow = { ...user, organization_id: membership.organization_id, role: membership.role };
  const orgResult = await query<OrgRow>(
    'SELECT id, name FROM organizations WHERE id = $1',
    [sessionUser.organization_id]
  );
  const org = orgResult.rows[0];
  await query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

  return buildAuthTokens(sessionUser, org);
}

const REFRESH_GRACE_SECONDS = 10;
const refreshRotatedKey = (tokenId: string) => `refresh:rotated:${tokenId}`;

/**
 * A refresh token that is already marked as used. If it was rotated a moment ago (two tabs refreshing
 * at once) the request is simply refused; otherwise it is treated as a stolen token and every token
 * of the user is invalidated. If Redis is unavailable the strict behaviour applies.
 */
async function rejectUsedRefreshToken(tokenId: string, userId: string): Promise<never> {
  const justRotated = async (): Promise<boolean> => {
    try {
      return (await redis.exists(refreshRotatedKey(tokenId))) === 1;
    } catch {
      return false;
    }
  };
  // The winner of the race sets the marker right after its UPDATE: allow it a moment to appear
  if ((await justRotated()) || (await new Promise((r) => setTimeout(r, 75)).then(justRotated))) {
    throw new AppError(401, 'Refresh token already rotated', 'TOKEN_ROTATED');
  }
  // Invalidate all tokens for this user (possible token theft)
  await query('UPDATE refresh_tokens SET used = true WHERE user_id = $1', [userId]);
  throw new AppError(401, 'Refresh token reuse detected. Please log in again.', 'TOKEN_REUSE');
}

export async function refreshToken(currentRefreshToken: string): Promise<AuthTokens> {
  const tokenHash = hashToken(currentRefreshToken);

  const tokenResult = await query<RefreshTokenRow>(
    `SELECT id, user_id, token_hash, expires_at, used
     FROM refresh_tokens
     WHERE token_hash = $1`,
    [tokenHash]
  );

  const storedToken = tokenResult.rows[0];

  if (!storedToken) {
    throw new AppError(401, 'Invalid refresh token', 'INVALID_REFRESH_TOKEN');
  }

  // Reuse detection (with a short grace period for concurrent renewals): token was already used
  if (storedToken.used) {
    await rejectUsedRefreshToken(storedToken.id, storedToken.user_id);
  }

  if (new Date(storedToken.expires_at) < new Date()) {
    throw new AppError(401, 'Refresh token expired', 'TOKEN_EXPIRED');
  }

  // The org this session belongs to lives in the refresh token's own JWT
  // claim, NOT users.organization_id — a user can belong to multiple orgs
  // (user_organizations, migration 048), and re-deriving the org from their
  // primary column here would silently switch a multi-org user back to
  // their primary org on every refresh, regardless of which org they
  // actually logged into (this was the CAØS Studio / Dysruptia bug).
  let payload: { userId: string; orgId: string; tokenId: string };
  try {
    payload = verifyRefreshToken(currentRefreshToken);
  } catch {
    throw new AppError(401, 'Invalid refresh token', 'INVALID_REFRESH_TOKEN');
  }
  if (payload.userId !== storedToken.user_id) {
    throw new AppError(401, 'Invalid refresh token', 'INVALID_REFRESH_TOKEN');
  }

  // Atomic gate: only one request can flip used from false to true
  const gate = await query<{ id: string }>(
    'UPDATE refresh_tokens SET used = true WHERE id = $1 AND used = false RETURNING id',
    [storedToken.id]
  );
  if (gate.rows.length === 0) {
    await rejectUsedRefreshToken(storedToken.id, storedToken.user_id);
  }
  // Marker for the concurrent request that lost the race (set right away, before any other work)
  await redis.set(refreshRotatedKey(storedToken.id), '1', 'EX', REFRESH_GRACE_SECONDS).catch(() => undefined);

  const userResult = await query<UserRow>(
    `SELECT u.id, u.email, u.name, u.role, u.organization_id, u.password_hash,
            u.totp_enabled, u.totp_secret_encrypted, u.last_login_at, u.language,
            u.onboarding_completed, u.onboarding_step, u.editor_tour_completed, u.is_super_admin
     FROM users u WHERE u.id = $1`,
    [storedToken.user_id]
  );
  const user = userResult.rows[0];
  if (!user) {
    throw new AppError(401, 'User not found', 'USER_NOT_FOUND');
  }

  const membershipResult = await query<{ role: string }>(
    'SELECT role FROM user_organizations WHERE user_id = $1 AND organization_id = $2',
    [payload.userId, payload.orgId]
  );
  const membership = membershipResult.rows[0];
  if (!membership) {
    throw new AppError(403, 'User is no longer a member of this organization', 'NOT_A_MEMBER');
  }

  const orgResult = await query<OrgRow>(
    'SELECT id, name FROM organizations WHERE id = $1',
    [payload.orgId]
  );
  const org = orgResult.rows[0];
  if (!org) {
    throw new AppError(404, 'Organization not found', 'ORG_NOT_FOUND');
  }

  const targetUser: UserRow = { ...user, organization_id: payload.orgId, role: membership.role };
  return buildAuthTokens(targetUser, org);
}

export async function logout(currentRefreshToken: string): Promise<void> {
  const tokenHash = hashToken(currentRefreshToken);
  await query('UPDATE refresh_tokens SET used = true WHERE token_hash = $1', [tokenHash]);
}

export async function generateEmailVerificationToken(userId: string, promoCode?: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await query(
    `INSERT INTO email_verifications (id, user_id, token_hash, expires_at, promo_code, created_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())`,
    [userId, tokenHash, expiresAt.toISOString(), promoCode ?? null]
  );

  return token;
}

export async function consumeEmailVerificationToken(token: string): Promise<void> {
  const tokenHash = hashToken(token);

  const client = await getClient();
  let user: { email: string; name: string; organization_id: string } | undefined;
  try {
    await client.query('BEGIN');

    const claimed = await client.query<{ user_id: string; promo_code: string | null }>(
      `UPDATE email_verifications SET used = true
       WHERE token_hash = $1 AND used = false AND expires_at > NOW()
       RETURNING user_id, promo_code`,
      [tokenHash]
    );
    const row = claimed.rows[0];
    if (!row) {
      await client.query('ROLLBACK');
      throw new AppError(400, 'Invalid or expired verification token', 'INVALID_VERIFICATION_TOKEN');
    }

    const updated = await client.query<{ email: string; name: string; organization_id: string }>(
      'UPDATE users SET email_verified = true, updated_at = NOW() WHERE id = $1 RETURNING email, name, organization_id',
      [row.user_id]
    );
    user = updated.rows[0];

    // Apply the promo code chosen at registration, re-validated now: it may have expired or been
    // exhausted by others since. If so the account is still verified and simply stays on Free.
    if (row.promo_code && user) {
      const promo = await findValidPromo(client, row.promo_code);
      if (promo) {
        // Guarded increment: never goes past max_uses even with concurrent verifications
        const bumped = await client.query(
          `UPDATE promo_codes SET used_count = used_count + 1
           WHERE id = $1 AND (max_uses IS NULL OR used_count < max_uses)`,
          [promo.id]
        );
        if ((bumped.rowCount ?? 0) > 0) {
          const trialEndsAt = new Date();
          trialEndsAt.setDate(trialEndsAt.getDate() + promo.duration_days);
          await client.query(
            `UPDATE organizations
             SET plan = $1, trial_ends_at = $2, promo_code_id = $3, updated_at = NOW()
             WHERE id = $4`,
            [promo.plan, trialEndsAt.toISOString(), promo.id, user.organization_id]
          );
        }
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }

  if (user) {
    sendWelcomeEmail({ name: user.name, email: user.email }).catch(err =>
      console.error('[Email] Failed to send welcome email:', err)
    );
  }
}

export async function resendVerificationEmail(email: string): Promise<void> {
  // Same per-email hourly cap as forgot-password, under its own key. Over the limit nothing is created
  // or sent; the caller still answers the same generic message. Redis down: carry on.
  try {
    const count = await recordFailure(
      buildAttemptKey(['resend-verify', email.toLowerCase()]),
      ATTEMPT_LIMITS.forgotPasswordPerEmail.windowSeconds
    );
    if (count > ATTEMPT_LIMITS.forgotPasswordPerEmail.max) return;
  } catch {
    console.warn('[auth] Resend-verification limiter unavailable (Redis error): request allowed');
  }

  const result = await query<{ id: string; email: string; name: string; email_verified: boolean }>(
    'SELECT id, email, name, email_verified FROM users WHERE email = $1',
    [email.toLowerCase()]
  );
  const user = result.rows[0];

  // Never reveal whether the email exists or is already verified
  if (!user || user.email_verified) return;

  // Carry over the promo code chosen at registration, so asking for a new link does not lose it
  const previous = await query<{ promo_code: string }>(
    `SELECT promo_code FROM email_verifications
     WHERE user_id = $1 AND promo_code IS NOT NULL
     ORDER BY created_at DESC LIMIT 1`,
    [user.id]
  );
  const token = await generateEmailVerificationToken(user.id, previous.rows[0]?.promo_code);
  sendVerificationEmail({ name: user.name, email: user.email }, token).catch(err =>
    console.error('[Email] Failed to resend verification email:', err)
  );
}

export async function forgotPassword(email: string): Promise<void> {
  // At most 3 requests per email per hour. Over the limit nothing is created or sent, and the caller
  // still answers the same generic message (the limit is never revealed). Redis down: carry on.
  try {
    const count = await recordFailure(
      buildAttemptKey(['forgot', email.toLowerCase()]),
      ATTEMPT_LIMITS.forgotPasswordPerEmail.windowSeconds
    );
    if (count > ATTEMPT_LIMITS.forgotPasswordPerEmail.max) return;
  } catch {
    console.warn('[auth] Forgot-password limiter unavailable (Redis error): request allowed');
  }

  const result = await query<UserRow>(
    'SELECT id, email, name FROM users WHERE email = $1',
    [email.toLowerCase()]
  );
  const user = result.rows[0];

  // Always respond OK — don't reveal if email exists
  if (!user) return;

  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await query(
    `INSERT INTO password_resets (id, user_id, token_hash, expires_at, created_at)
     VALUES (gen_random_uuid(), $1, $2, $3, NOW())`,
    [user.id, tokenHash, expiresAt.toISOString()]
  );

  sendPasswordResetEmail({ name: user.name, email: user.email }, token).catch(err =>
    console.error('[Email] Failed to send password reset email:', err)
  );
}

export async function resetPassword(input: {
  token: string;
  password: string;
}): Promise<void> {
  const tokenHash = hashToken(input.token);

  // Hash first (slow), then claim the token and change the password in one transaction
  const passwordHash = await bcrypt.hash(input.password, 12);

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const claimed = await client.query<{ user_id: string }>(
      `UPDATE password_resets SET used = true
       WHERE token_hash = $1 AND used = false AND expires_at > NOW()
       RETURNING user_id`,
      [tokenHash]
    );
    const row = claimed.rows[0];
    if (!row) {
      await client.query('ROLLBACK');
      throw new AppError(400, 'Invalid or expired reset token', 'INVALID_RESET_TOKEN');
    }

    // Using an emailed reset link proves the user reads this mailbox, so the email counts as verified too
    await client.query(
      'UPDATE users SET password_hash = $1, email_verified = true, updated_at = NOW() WHERE id = $2',
      [passwordHash, row.user_id]
    );
    // Invalidate all refresh tokens
    await client.query('UPDATE refresh_tokens SET used = true WHERE user_id = $1', [row.user_id]);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export async function setup2FA(_userId: string): Promise<{ secret: string; qrCode: string }> {
  const generated = speakeasy.generateSecret({ name: 'GenSmart', issuer: 'GenSmart' });
  const qrCode = await qrcode.toDataURL(generated.otpauth_url ?? '');
  return { secret: generated.base32, qrCode };
}

export async function enable2FA(
  userId: string,
  secret: string,
  code: string
): Promise<{ backupCodes: string[] }> {
  // A second factor that is already active cannot be replaced from here (disable it first)
  const current = await query<{ totp_enabled: boolean }>('SELECT totp_enabled FROM users WHERE id = $1', [userId]);
  if (current.rows[0]?.totp_enabled) {
    throw new AppError(409, '2FA is already enabled', 'TOTP_ALREADY_ENABLED');
  }

  const isValid = speakeasy.totp.verify({ secret, token: code, encoding: 'base32', window: 1 });
  if (!isValid) {
    throw new AppError(400, 'Invalid 2FA code', 'INVALID_2FA_CODE');
  }

  const encryptedSecret = encrypt(secret);
  await query(
    `UPDATE users SET totp_secret_encrypted = $1, totp_enabled = true, updated_at = NOW() WHERE id = $2`,
    [encryptedSecret, userId]
  );

  // Delete old backup codes
  await query('DELETE FROM backup_codes WHERE user_id = $1', [userId]);

  // Generate 10 backup codes
  const rawCodes: string[] = [];
  const insertValues: string[] = [];
  const insertParams: unknown[] = [];

  for (let i = 0; i < 10; i++) {
    const rawCode = generateRandomCode(8);
    rawCodes.push(rawCode);
    const codeHash = hashToken(rawCode);
    const paramBase = i * 3;
    insertValues.push(`(gen_random_uuid(), $${paramBase + 1}, $${paramBase + 2}, $${paramBase + 3}, NOW())`);
    insertParams.push(userId, codeHash, false);
  }

  await query(
    `INSERT INTO backup_codes (id, user_id, code_hash, used, created_at) VALUES ${insertValues.join(', ')}`,
    insertParams
  );

  return { backupCodes: rawCodes };
}

/**
 * Create a brand-new Organization and either a new User (owner) or a bridge
 * membership to an existing User (identified by email), without issuing any
 * session/JWT. Callable from a non-HTTP context (e.g. an internal
 * provisioning webhook) — no req/res dependency.
 *
 * Does NOT touch the existing user's `users.organization_id`/`role` when
 * linking to an already-registered email: that column keeps acting as their
 * primary org for normal password login, exactly as before. The new
 * membership is recorded only in `user_organizations`, and access to this
 * specific org is granted via the org-access token flow below (which reads
 * the org id from the token, not from `users.organization_id`).
 */
export async function provisionOrganization(input: {
  email: string;
  name: string;
  organizationName: string;
  plan: string;
  billingSource: string;
  externalSubscriptionId: string;
}): Promise<{ userId: string; organizationId: string; isNewUser: boolean }> {
  const email = input.email.toLowerCase();
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const orgSlug = slugify(`${input.organizationName}-${crypto.randomBytes(3).toString('hex')}`);
    const orgResult = await client.query<{ id: string }>(
      `INSERT INTO organizations
         (id, name, slug, plan, subscription_status, billing_source, external_subscription_id, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, 'active', $4, $5, NOW(), NOW())
       RETURNING id`,
      [input.organizationName, orgSlug, input.plan, input.billingSource, input.externalSubscriptionId]
    );
    const organizationId = orgResult.rows[0]!.id;

    const existingUser = await client.query<{ id: string }>(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    let userId: string;
    const isNewUser = existingUser.rows.length === 0;

    if (isNewUser) {
      const tempPasswordHash = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
      const userResult = await client.query<{ id: string }>(
        `INSERT INTO users (id, organization_id, email, name, password_hash, role, email_verified, onboarding_completed, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, 'owner', false, true, NOW(), NOW())
         RETURNING id`,
        [organizationId, email, input.name, tempPasswordHash]
      );
      userId = userResult.rows[0]!.id;
    } else {
      userId = existingUser.rows[0]!.id;
    }

    // Owner of this specific org either way — it's their store, regardless of
    // whether they already own a different GenSmart organization elsewhere.
    await client.query(
      `INSERT INTO user_organizations (user_id, organization_id, role, created_at)
       VALUES ($1, $2, 'owner', NOW())
       ON CONFLICT (user_id, organization_id) DO NOTHING`,
      [userId, organizationId]
    );

    await client.query('COMMIT');
    return { userId, organizationId, isNewUser };
  } catch (err) {
    await client.query('ROLLBACK');
    if (err && typeof err === 'object' && 'code' in err && (err as Record<string, unknown>).code === '23505') {
      throw new AppError(409, 'Organization slug collision, please retry', 'ORG_SLUG_TAKEN');
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Generate a one-time passwordless access token scoped to one specific
 * (user, organization) pair and email it. Unlike `forgotPassword`, the
 * consuming endpoint never asks for a password — it logs the user straight
 * into that organization.
 */
export async function generateOrgAccessToken(
  userId: string,
  organizationId: string
): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await query(
    `INSERT INTO org_access_tokens (id, user_id, organization_id, token_hash, expires_at, created_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())`,
    [userId, organizationId, tokenHash, expiresAt.toISOString()]
  );

  return token;
}

export async function sendOrgAccessLinkEmail(
  userId: string,
  organizationId: string,
  storeName: string
): Promise<void> {
  const userResult = await query<{ email: string; name: string }>(
    'SELECT email, name FROM users WHERE id = $1',
    [userId]
  );
  const user = userResult.rows[0];
  if (!user) throw new AppError(404, 'User not found', 'USER_NOT_FOUND');

  const token = await generateOrgAccessToken(userId, organizationId);

  // Fire-and-forget, matching sendWelcomeEmail/forgotPassword: a transient
  // SMTP failure must not roll back provisioning (org/agent/MCP already
  // exist by the time this runs) or block the caller's response.
  sendOrgAccessEmail({ name: user.name, email: user.email }, storeName, token).catch((err) =>
    console.error('[Email] Failed to send org access email:', err)
  );
}

/**
 * Consume a passwordless org-access token and return full session tokens
 * scoped to the organization the link was generated for — which may differ
 * from the user's `users.organization_id` (their other, primary org). Reads
 * the effective role from `user_organizations` for that specific org.
 */
export async function consumeOrgAccessToken(token: string): Promise<AuthTokens | TwoFactorRequired> {
  const tokenHash = hashToken(token);

  // Atomic gate: the first request to flip used from false to true gets the token
  const claimed = await query<{ id: string; user_id: string; organization_id: string }>(
    `UPDATE org_access_tokens SET used = true
     WHERE token_hash = $1 AND used = false AND expires_at > NOW()
     RETURNING id, user_id, organization_id`,
    [tokenHash]
  );
  const tokenRow = claimed.rows[0];
  if (!tokenRow) {
    throw new AppError(400, 'Invalid or expired access token', 'INVALID_ACCESS_TOKEN');
  }

  const membershipResult = await query<{ role: string }>(
    'SELECT role FROM user_organizations WHERE user_id = $1 AND organization_id = $2',
    [tokenRow.user_id, tokenRow.organization_id]
  );
  const membership = membershipResult.rows[0];
  if (!membership) {
    throw new AppError(403, 'User is not a member of this organization', 'NOT_A_MEMBER');
  }

  const userResult = await query<UserRow>(
    `SELECT u.id, u.email, u.name, u.role, u.organization_id, u.password_hash,
            u.totp_enabled, u.totp_secret_encrypted, u.last_login_at, u.language,
            u.onboarding_completed, u.onboarding_step, u.editor_tour_completed, u.is_super_admin
     FROM users u WHERE u.id = $1`,
    [tokenRow.user_id]
  );
  const user = userResult.rows[0];
  if (!user) throw new AppError(404, 'User not found', 'USER_NOT_FOUND');

  const orgResult = await query<OrgRow>(
    'SELECT id, name FROM organizations WHERE id = $1',
    [tokenRow.organization_id]
  );
  const org = orgResult.rows[0];
  if (!org) throw new AppError(404, 'Organization not found', 'ORG_NOT_FOUND');

  // The link must not skip the second factor: the session is issued after /2fa/verify
  if (user.totp_enabled) {
    const tempToken = generateTempToken({ userId: user.id, purpose: '2fa', orgId: tokenRow.organization_id });
    return { requires2FA: true, tempToken };
  }

  await query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

  // Override organization_id/role with the token's target org — not the
  // user's `users.organization_id`, which may point at a different org.
  const targetUser: UserRow = {
    ...user,
    organization_id: tokenRow.organization_id,
    role: membership.role,
  };
  return buildAuthTokens(targetUser, org);
}

/**
 * Resends org access via a stale org_access_tokens row (used or expired) —
 * the row itself is never deleted on consume, only marked `used`, so its id
 * still tells us which organization the merchant was trying to reach. This
 * is the only path back in for a passwordless account: there's no password
 * to reset, and a generic "forgot password" would land on the user's
 * primary org anyway (same class of bug fixed in refreshToken()), not the
 * Tiendanube org the stale link pointed at.
 *
 * Deliberately silent on every "nothing to do" branch (unknown token id,
 * rate-limited, user no longer a member) — the caller always returns the
 * same generic success message regardless, so this endpoint can't be used
 * to probe whether a given token/org exists.
 */
export async function resendOrgAccessEmail(originalToken: string): Promise<void> {
  const tokenHash = hashToken(originalToken);

  const tokenResult = await query<{ id: string; user_id: string; organization_id: string }>(
    `SELECT id, user_id, organization_id FROM org_access_tokens WHERE token_hash = $1`,
    [tokenHash]
  );
  const tokenRow = tokenResult.rows[0];
  if (!tokenRow) return;

  // Max 1 resend per 5 min per organization (not per token id) — several
  // stale links for the same org all funnel into the same throttle, which is
  // the actual abuse surface (someone spamming the "Resend access" button).
  const rateLimitKey = `org-access-resend:${tokenRow.organization_id}`;
  const acquired = await redis.set(rateLimitKey, '1', 'EX', 300, 'NX');
  if (!acquired) return;

  const membershipResult = await query<{ id: string }>(
    'SELECT 1 as id FROM user_organizations WHERE user_id = $1 AND organization_id = $2',
    [tokenRow.user_id, tokenRow.organization_id]
  );
  if (!membershipResult.rows[0]) return;

  const orgResult = await query<{ name: string }>(
    'SELECT name FROM organizations WHERE id = $1',
    [tokenRow.organization_id]
  );
  const org = orgResult.rows[0];
  if (!org) return;

  // Generates a fresh token + sends the email — same mechanism as the
  // original magic link (fire-and-forget on SMTP failure).
  await sendOrgAccessLinkEmail(tokenRow.user_id, tokenRow.organization_id, org.name);
}

export async function disable2FA(userId: string, password: string): Promise<void> {
  const result = await query<{ password_hash: string }>(
    'SELECT password_hash FROM users WHERE id = $1',
    [userId]
  );
  const user = result.rows[0];
  if (!user) {
    throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  }

  const passwordMatch = await guardPasswordCheck(userId, () => bcrypt.compare(password, user.password_hash));
  if (!passwordMatch) {
    throw new AppError(401, 'Invalid password', 'INVALID_PASSWORD');
  }

  await query(
    `UPDATE users SET totp_enabled = false, totp_secret_encrypted = NULL, updated_at = NOW() WHERE id = $1`,
    [userId]
  );
  await query('DELETE FROM backup_codes WHERE user_id = $1', [userId]);
}
