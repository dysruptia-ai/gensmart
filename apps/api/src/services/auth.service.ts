import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import { query, getClient } from '../config/database';
import { encrypt, decrypt } from '../config/encryption';
import {
  generateAccessToken,
  generateRefreshToken,
  generateTempToken,
  verifyTempToken,
} from '../config/jwt';
import {
  sendWelcomeEmail,
  sendPasswordResetEmail,
} from '../config/email';
import { AppError } from '../middleware/errorHandler';

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

async function buildAuthTokens(user: UserRow, org: OrgRow): Promise<AuthTokens> {
  // Note: user.totp_enabled is included in the returned user object so the frontend
  // can correctly show the 2FA status without an extra API call
  const tokenId = crypto.randomUUID();
  const accessToken = generateAccessToken({
    userId: user.id,
    orgId: user.organization_id,
    role: user.role,
    email: user.email,
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
    },
  };
}

export async function register(input: {
  email: string;
  password: string;
  name: string;
  organizationName: string;
}): Promise<AuthTokens> {
  const existing = await query<{ id: string }>(
    'SELECT id FROM users WHERE email = $1',
    [input.email.toLowerCase()]
  );
  if (existing.rows.length > 0) {
    throw new AppError(409, 'Email already registered', 'EMAIL_TAKEN');
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const client = await getClient();

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
       RETURNING id, email, name, role, organization_id, password_hash, totp_enabled, totp_secret_encrypted, last_login_at, language`,
      [org.id, input.email.toLowerCase(), input.name, passwordHash]
    );
    const user = userResult.rows[0];

    const tokenId = crypto.randomUUID();
    const accessToken = generateAccessToken({
      userId: user.id,
      orgId: user.organization_id,
      role: user.role,
      email: user.email,
    });
    const refreshTokenRaw = generateRefreshToken({
      userId: user.id,
      orgId: user.organization_id,
      tokenId,
    });
    const tokenHash = hashToken(refreshTokenRaw);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await client.query(
      `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [tokenId, user.id, tokenHash, expiresAt.toISOString()]
    );

    await client.query('COMMIT');

    // Send welcome email async (don't block)
    sendWelcomeEmail({ name: user.name, email: user.email }).catch(err =>
      console.error('[Email] Failed to send welcome email:', err)
    );

    // Create Stripe customer async (don't block registration)
    import('../services/stripe.service').then(({ createCustomer }) =>
      createCustomer(org.id, input.email.toLowerCase(), input.name).catch(err =>
        console.error('[Stripe] Failed to create customer on register:', err)
      )
    ).catch(() => {/* ignore import error */});

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
      },
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<AuthTokens | TwoFactorRequired> {
  const result = await query<UserRow>(
    `SELECT u.id, u.email, u.name, u.role, u.organization_id, u.password_hash,
            u.totp_enabled, u.totp_secret_encrypted, u.last_login_at, u.language
     FROM users u
     WHERE u.email = $1`,
    [input.email.toLowerCase()]
  );

  const user = result.rows[0];
  if (!user) {
    throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const passwordMatch = await bcrypt.compare(input.password, user.password_hash);
  if (!passwordMatch) {
    throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  }

  if (user.totp_enabled) {
    const tempToken = generateTempToken({ userId: user.id, purpose: '2fa' });
    return { requires2FA: true, tempToken };
  }

  const orgResult = await query<OrgRow>(
    'SELECT id, name FROM organizations WHERE id = $1',
    [user.organization_id]
  );
  const org = orgResult.rows[0];

  await query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

  return buildAuthTokens(user, org);
}

export async function verify2FA(input: {
  tempToken: string;
  code: string;
}): Promise<AuthTokens> {
  let payload: { userId: string };
  try {
    payload = verifyTempToken(input.tempToken);
  } catch {
    throw new AppError(401, 'Invalid or expired token', 'INVALID_TOKEN');
  }

  const result = await query<UserRow>(
    `SELECT u.id, u.email, u.name, u.role, u.organization_id, u.password_hash,
            u.totp_enabled, u.totp_secret_encrypted, u.last_login_at, u.language
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
      throw new AppError(401, 'Invalid 2FA code', 'INVALID_2FA_CODE');
    }

    await query('UPDATE backup_codes SET used = true, used_at = NOW() WHERE id = $1', [matchingCode.id]);
  }

  const orgResult = await query<OrgRow>(
    'SELECT id, name FROM organizations WHERE id = $1',
    [user.organization_id]
  );
  const org = orgResult.rows[0];
  await query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

  return buildAuthTokens(user, org);
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

  // Reuse detection: token was already used
  if (storedToken.used) {
    // Invalidate all tokens for this user (possible token theft)
    await query('UPDATE refresh_tokens SET used = true WHERE user_id = $1', [storedToken.user_id]);
    throw new AppError(401, 'Refresh token reuse detected. Please log in again.', 'TOKEN_REUSE');
  }

  if (new Date(storedToken.expires_at) < new Date()) {
    throw new AppError(401, 'Refresh token expired', 'TOKEN_EXPIRED');
  }

  // Mark current token as used
  await query('UPDATE refresh_tokens SET used = true WHERE id = $1', [storedToken.id]);

  const userResult = await query<UserRow>(
    `SELECT u.id, u.email, u.name, u.role, u.organization_id, u.password_hash,
            u.totp_enabled, u.totp_secret_encrypted, u.last_login_at, u.language
     FROM users u WHERE u.id = $1`,
    [storedToken.user_id]
  );
  const user = userResult.rows[0];
  if (!user) {
    throw new AppError(401, 'User not found', 'USER_NOT_FOUND');
  }

  const orgResult = await query<OrgRow>(
    'SELECT id, name FROM organizations WHERE id = $1',
    [user.organization_id]
  );
  const org = orgResult.rows[0];

  return buildAuthTokens(user, org);
}

export async function logout(currentRefreshToken: string): Promise<void> {
  const tokenHash = hashToken(currentRefreshToken);
  await query('UPDATE refresh_tokens SET used = true WHERE token_hash = $1', [tokenHash]);
}

export async function forgotPassword(email: string): Promise<void> {
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

  const resetResult = await query<{ id: string; user_id: string; used: boolean; expires_at: string }>(
    `SELECT id, user_id, used, expires_at
     FROM password_resets
     WHERE token_hash = $1`,
    [tokenHash]
  );
  const reset = resetResult.rows[0];

  if (!reset || reset.used || new Date(reset.expires_at) < new Date()) {
    throw new AppError(400, 'Invalid or expired reset token', 'INVALID_RESET_TOKEN');
  }

  const passwordHash = await bcrypt.hash(input.password, 12);

  await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [
    passwordHash,
    reset.user_id,
  ]);

  await query('UPDATE password_resets SET used = true WHERE id = $1', [reset.id]);

  // Invalidate all refresh tokens
  await query('UPDATE refresh_tokens SET used = true WHERE user_id = $1', [reset.user_id]);
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

export async function disable2FA(userId: string, password: string): Promise<void> {
  const result = await query<{ password_hash: string }>(
    'SELECT password_hash FROM users WHERE id = $1',
    [userId]
  );
  const user = result.rows[0];
  if (!user) {
    throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  }

  const passwordMatch = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatch) {
    throw new AppError(401, 'Invalid password', 'INVALID_PASSWORD');
  }

  await query(
    `UPDATE users SET totp_enabled = false, totp_secret_encrypted = NULL, updated_at = NOW() WHERE id = $1`,
    [userId]
  );
  await query('DELETE FROM backup_codes WHERE user_id = $1', [userId]);
}
