"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
exports.login = login;
exports.verify2FA = verify2FA;
exports.refreshToken = refreshToken;
exports.logout = logout;
exports.forgotPassword = forgotPassword;
exports.resetPassword = resetPassword;
exports.setup2FA = setup2FA;
exports.enable2FA = enable2FA;
exports.provisionOrganization = provisionOrganization;
exports.generateOrgAccessToken = generateOrgAccessToken;
exports.sendOrgAccessLinkEmail = sendOrgAccessLinkEmail;
exports.consumeOrgAccessToken = consumeOrgAccessToken;
exports.disable2FA = disable2FA;
const crypto_1 = __importDefault(require("crypto"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const speakeasy_1 = __importDefault(require("speakeasy"));
const qrcode_1 = __importDefault(require("qrcode"));
const database_1 = require("../config/database");
const encryption_1 = require("../config/encryption");
const jwt_1 = require("../config/jwt");
const email_1 = require("../config/email");
const errorHandler_1 = require("../middleware/errorHandler");
function hashToken(token) {
    return crypto_1.default.createHash('sha256').update(token).digest('hex');
}
function slugify(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}
function generateRandomCode(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    const bytes = crypto_1.default.randomBytes(length);
    for (let i = 0; i < length; i++) {
        code += chars[bytes[i] % chars.length];
    }
    return code;
}
async function buildAuthTokens(user, org) {
    // Note: user.totp_enabled is included in the returned user object so the frontend
    // can correctly show the 2FA status without an extra API call
    const tokenId = crypto_1.default.randomUUID();
    const accessToken = (0, jwt_1.generateAccessToken)({
        userId: user.id,
        orgId: user.organization_id,
        role: user.role,
        email: user.email,
        isSuperAdmin: user.is_super_admin || false,
    });
    const refreshTokenRaw = (0, jwt_1.generateRefreshToken)({
        userId: user.id,
        orgId: user.organization_id,
        tokenId,
    });
    const tokenHash = hashToken(refreshTokenRaw);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await (0, database_1.query)(`INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
     VALUES ($1, $2, $3, $4, NOW())`, [tokenId, user.id, tokenHash, expiresAt.toISOString()]);
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
async function register(input) {
    const existing = await (0, database_1.query)('SELECT id FROM users WHERE email = $1', [input.email.toLowerCase()]);
    if (existing.rows.length > 0) {
        throw new errorHandler_1.AppError(409, 'Email already registered', 'EMAIL_TAKEN');
    }
    const passwordHash = await bcryptjs_1.default.hash(input.password, 12);
    const client = await (0, database_1.getClient)();
    try {
        await client.query('BEGIN');
        const orgSlug = slugify(input.organizationName);
        const orgResult = await client.query(`INSERT INTO organizations (id, name, slug, plan, subscription_status, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, 'free', 'active', NOW(), NOW())
       RETURNING id, name`, [input.organizationName, orgSlug]);
        const org = orgResult.rows[0];
        const userResult = await client.query(`INSERT INTO users (id, organization_id, email, name, password_hash, role, email_verified, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'owner', false, NOW(), NOW())
       RETURNING id, email, name, role, organization_id, password_hash, totp_enabled, totp_secret_encrypted, last_login_at, language, is_super_admin`, [org.id, input.email.toLowerCase(), input.name, passwordHash]);
        const user = userResult.rows[0];
        await client.query(`INSERT INTO user_organizations (user_id, organization_id, role, created_at)
       VALUES ($1, $2, 'owner', NOW())
       ON CONFLICT (user_id, organization_id) DO NOTHING`, [user.id, org.id]);
        const tokenId = crypto_1.default.randomUUID();
        const accessToken = (0, jwt_1.generateAccessToken)({
            userId: user.id,
            orgId: user.organization_id,
            role: user.role,
            email: user.email,
            isSuperAdmin: false,
        });
        const refreshTokenRaw = (0, jwt_1.generateRefreshToken)({
            userId: user.id,
            orgId: user.organization_id,
            tokenId,
        });
        const tokenHash = hashToken(refreshTokenRaw);
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await client.query(`INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
       VALUES ($1, $2, $3, $4, NOW())`, [tokenId, user.id, tokenHash, expiresAt.toISOString()]);
        // If promo code provided, validate and apply
        if (input.promoCode) {
            const promoResult = await client.query(`SELECT id, plan, duration_days, max_uses, used_count, is_active, expires_at
         FROM promo_codes WHERE code = $1`, [input.promoCode.toUpperCase().trim()]);
            const promo = promoResult.rows[0];
            if (promo && promo.is_active
                && (promo.max_uses === null || promo.used_count < promo.max_uses)
                && (!promo.expires_at || new Date(promo.expires_at) > new Date())) {
                const trialEndsAt = new Date();
                trialEndsAt.setDate(trialEndsAt.getDate() + promo.duration_days);
                await client.query(`UPDATE organizations
           SET plan = $1, trial_ends_at = $2, promo_code_id = $3, updated_at = NOW()
           WHERE id = $4`, [promo.plan, trialEndsAt.toISOString(), promo.id, org.id]);
                await client.query(`UPDATE promo_codes SET used_count = used_count + 1 WHERE id = $1`, [promo.id]);
            }
            // If code is invalid, silently ignore — user still registers on Free plan
        }
        await client.query('COMMIT');
        // Send welcome email async (don't block)
        (0, email_1.sendWelcomeEmail)({ name: user.name, email: user.email }).catch(err => console.error('[Email] Failed to send welcome email:', err));
        // Create Stripe customer async (don't block registration)
        Promise.resolve().then(() => __importStar(require('../services/stripe.service'))).then(({ createCustomer }) => createCustomer(org.id, input.email.toLowerCase(), input.name).catch(err => console.error('[Stripe] Failed to create customer on register:', err))).catch(() => { });
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
                onboardingCompleted: false,
                onboardingStep: 0,
                editorTourCompleted: false,
                isSuperAdmin: false,
            },
        };
    }
    catch (err) {
        await client.query('ROLLBACK');
        // Handle unique constraint violation on org slug
        if (err && typeof err === 'object' && 'code' in err && err.code === '23505') {
            throw new errorHandler_1.AppError(409, 'Organization name already taken. Please choose a different name.', 'ORG_SLUG_TAKEN');
        }
        throw err;
    }
    finally {
        client.release();
    }
}
async function login(input) {
    const result = await (0, database_1.query)(`SELECT u.id, u.email, u.name, u.role, u.organization_id, u.password_hash,
            u.totp_enabled, u.totp_secret_encrypted, u.last_login_at, u.language,
            u.onboarding_completed, u.onboarding_step, u.editor_tour_completed, u.is_super_admin
     FROM users u
     WHERE u.email = $1`, [input.email.toLowerCase()]);
    const user = result.rows[0];
    if (!user) {
        throw new errorHandler_1.AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
    }
    const passwordMatch = await bcryptjs_1.default.compare(input.password, user.password_hash);
    if (!passwordMatch) {
        throw new errorHandler_1.AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
    }
    if (user.totp_enabled) {
        const tempToken = (0, jwt_1.generateTempToken)({ userId: user.id, purpose: '2fa' });
        return { requires2FA: true, tempToken };
    }
    const orgResult = await (0, database_1.query)('SELECT id, name FROM organizations WHERE id = $1', [user.organization_id]);
    const org = orgResult.rows[0];
    await (0, database_1.query)('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);
    return buildAuthTokens(user, org);
}
async function verify2FA(input) {
    let payload;
    try {
        payload = (0, jwt_1.verifyTempToken)(input.tempToken);
    }
    catch {
        throw new errorHandler_1.AppError(401, 'Invalid or expired token', 'INVALID_TOKEN');
    }
    const result = await (0, database_1.query)(`SELECT u.id, u.email, u.name, u.role, u.organization_id, u.password_hash,
            u.totp_enabled, u.totp_secret_encrypted, u.last_login_at, u.language,
            u.onboarding_completed, u.onboarding_step, u.editor_tour_completed, u.is_super_admin
     FROM users u WHERE u.id = $1`, [payload.userId]);
    const user = result.rows[0];
    if (!user || !user.totp_enabled || !user.totp_secret_encrypted) {
        throw new errorHandler_1.AppError(401, 'Invalid token', 'INVALID_TOKEN');
    }
    const secret = (0, encryption_1.decrypt)(user.totp_secret_encrypted);
    const isValid = speakeasy_1.default.totp.verify({ secret, token: input.code, encoding: 'base32', window: 1 });
    if (!isValid) {
        // Try backup codes
        const backupCodes = await (0, database_1.query)('SELECT id, code_hash, used FROM backup_codes WHERE user_id = $1 AND used = false', [user.id]);
        const codeHash = hashToken(input.code.toUpperCase());
        const matchingCode = backupCodes.rows.find(bc => bc.code_hash === codeHash);
        if (!matchingCode) {
            throw new errorHandler_1.AppError(401, 'Invalid 2FA code', 'INVALID_2FA_CODE');
        }
        await (0, database_1.query)('UPDATE backup_codes SET used = true, used_at = NOW() WHERE id = $1', [matchingCode.id]);
    }
    const orgResult = await (0, database_1.query)('SELECT id, name FROM organizations WHERE id = $1', [user.organization_id]);
    const org = orgResult.rows[0];
    await (0, database_1.query)('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);
    return buildAuthTokens(user, org);
}
async function refreshToken(currentRefreshToken) {
    const tokenHash = hashToken(currentRefreshToken);
    const tokenResult = await (0, database_1.query)(`SELECT id, user_id, token_hash, expires_at, used
     FROM refresh_tokens
     WHERE token_hash = $1`, [tokenHash]);
    const storedToken = tokenResult.rows[0];
    if (!storedToken) {
        throw new errorHandler_1.AppError(401, 'Invalid refresh token', 'INVALID_REFRESH_TOKEN');
    }
    // Reuse detection: token was already used
    if (storedToken.used) {
        // Invalidate all tokens for this user (possible token theft)
        await (0, database_1.query)('UPDATE refresh_tokens SET used = true WHERE user_id = $1', [storedToken.user_id]);
        throw new errorHandler_1.AppError(401, 'Refresh token reuse detected. Please log in again.', 'TOKEN_REUSE');
    }
    if (new Date(storedToken.expires_at) < new Date()) {
        throw new errorHandler_1.AppError(401, 'Refresh token expired', 'TOKEN_EXPIRED');
    }
    // The org this session belongs to lives in the refresh token's own JWT
    // claim, NOT users.organization_id — a user can belong to multiple orgs
    // (user_organizations, migration 048), and re-deriving the org from their
    // primary column here would silently switch a multi-org user back to
    // their primary org on every refresh, regardless of which org they
    // actually logged into (this was the CAØS Studio / Dysruptia bug).
    let payload;
    try {
        payload = (0, jwt_1.verifyRefreshToken)(currentRefreshToken);
    }
    catch {
        throw new errorHandler_1.AppError(401, 'Invalid refresh token', 'INVALID_REFRESH_TOKEN');
    }
    if (payload.userId !== storedToken.user_id) {
        throw new errorHandler_1.AppError(401, 'Invalid refresh token', 'INVALID_REFRESH_TOKEN');
    }
    // Mark current token as used
    await (0, database_1.query)('UPDATE refresh_tokens SET used = true WHERE id = $1', [storedToken.id]);
    const userResult = await (0, database_1.query)(`SELECT u.id, u.email, u.name, u.role, u.organization_id, u.password_hash,
            u.totp_enabled, u.totp_secret_encrypted, u.last_login_at, u.language,
            u.onboarding_completed, u.onboarding_step, u.editor_tour_completed, u.is_super_admin
     FROM users u WHERE u.id = $1`, [storedToken.user_id]);
    const user = userResult.rows[0];
    if (!user) {
        throw new errorHandler_1.AppError(401, 'User not found', 'USER_NOT_FOUND');
    }
    const membershipResult = await (0, database_1.query)('SELECT role FROM user_organizations WHERE user_id = $1 AND organization_id = $2', [payload.userId, payload.orgId]);
    const membership = membershipResult.rows[0];
    if (!membership) {
        throw new errorHandler_1.AppError(403, 'User is no longer a member of this organization', 'NOT_A_MEMBER');
    }
    const orgResult = await (0, database_1.query)('SELECT id, name FROM organizations WHERE id = $1', [payload.orgId]);
    const org = orgResult.rows[0];
    if (!org) {
        throw new errorHandler_1.AppError(404, 'Organization not found', 'ORG_NOT_FOUND');
    }
    const targetUser = { ...user, organization_id: payload.orgId, role: membership.role };
    return buildAuthTokens(targetUser, org);
}
async function logout(currentRefreshToken) {
    const tokenHash = hashToken(currentRefreshToken);
    await (0, database_1.query)('UPDATE refresh_tokens SET used = true WHERE token_hash = $1', [tokenHash]);
}
async function forgotPassword(email) {
    const result = await (0, database_1.query)('SELECT id, email, name FROM users WHERE email = $1', [email.toLowerCase()]);
    const user = result.rows[0];
    // Always respond OK — don't reveal if email exists
    if (!user)
        return;
    const token = crypto_1.default.randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await (0, database_1.query)(`INSERT INTO password_resets (id, user_id, token_hash, expires_at, created_at)
     VALUES (gen_random_uuid(), $1, $2, $3, NOW())`, [user.id, tokenHash, expiresAt.toISOString()]);
    (0, email_1.sendPasswordResetEmail)({ name: user.name, email: user.email }, token).catch(err => console.error('[Email] Failed to send password reset email:', err));
}
async function resetPassword(input) {
    const tokenHash = hashToken(input.token);
    const resetResult = await (0, database_1.query)(`SELECT id, user_id, used, expires_at
     FROM password_resets
     WHERE token_hash = $1`, [tokenHash]);
    const reset = resetResult.rows[0];
    if (!reset || reset.used || new Date(reset.expires_at) < new Date()) {
        throw new errorHandler_1.AppError(400, 'Invalid or expired reset token', 'INVALID_RESET_TOKEN');
    }
    const passwordHash = await bcryptjs_1.default.hash(input.password, 12);
    await (0, database_1.query)('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [
        passwordHash,
        reset.user_id,
    ]);
    await (0, database_1.query)('UPDATE password_resets SET used = true WHERE id = $1', [reset.id]);
    // Invalidate all refresh tokens
    await (0, database_1.query)('UPDATE refresh_tokens SET used = true WHERE user_id = $1', [reset.user_id]);
}
async function setup2FA(_userId) {
    const generated = speakeasy_1.default.generateSecret({ name: 'GenSmart', issuer: 'GenSmart' });
    const qrCode = await qrcode_1.default.toDataURL(generated.otpauth_url ?? '');
    return { secret: generated.base32, qrCode };
}
async function enable2FA(userId, secret, code) {
    const isValid = speakeasy_1.default.totp.verify({ secret, token: code, encoding: 'base32', window: 1 });
    if (!isValid) {
        throw new errorHandler_1.AppError(400, 'Invalid 2FA code', 'INVALID_2FA_CODE');
    }
    const encryptedSecret = (0, encryption_1.encrypt)(secret);
    await (0, database_1.query)(`UPDATE users SET totp_secret_encrypted = $1, totp_enabled = true, updated_at = NOW() WHERE id = $2`, [encryptedSecret, userId]);
    // Delete old backup codes
    await (0, database_1.query)('DELETE FROM backup_codes WHERE user_id = $1', [userId]);
    // Generate 10 backup codes
    const rawCodes = [];
    const insertValues = [];
    const insertParams = [];
    for (let i = 0; i < 10; i++) {
        const rawCode = generateRandomCode(8);
        rawCodes.push(rawCode);
        const codeHash = hashToken(rawCode);
        const paramBase = i * 3;
        insertValues.push(`(gen_random_uuid(), $${paramBase + 1}, $${paramBase + 2}, $${paramBase + 3}, NOW())`);
        insertParams.push(userId, codeHash, false);
    }
    await (0, database_1.query)(`INSERT INTO backup_codes (id, user_id, code_hash, used, created_at) VALUES ${insertValues.join(', ')}`, insertParams);
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
async function provisionOrganization(input) {
    const email = input.email.toLowerCase();
    const client = await (0, database_1.getClient)();
    try {
        await client.query('BEGIN');
        const orgSlug = slugify(`${input.organizationName}-${crypto_1.default.randomBytes(3).toString('hex')}`);
        const orgResult = await client.query(`INSERT INTO organizations
         (id, name, slug, plan, subscription_status, billing_source, external_subscription_id, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, 'active', $4, $5, NOW(), NOW())
       RETURNING id`, [input.organizationName, orgSlug, input.plan, input.billingSource, input.externalSubscriptionId]);
        const organizationId = orgResult.rows[0].id;
        const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [email]);
        let userId;
        const isNewUser = existingUser.rows.length === 0;
        if (isNewUser) {
            const tempPasswordHash = await bcryptjs_1.default.hash(crypto_1.default.randomBytes(16).toString('hex'), 10);
            const userResult = await client.query(`INSERT INTO users (id, organization_id, email, name, password_hash, role, email_verified, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, 'owner', false, NOW(), NOW())
         RETURNING id`, [organizationId, email, input.name, tempPasswordHash]);
            userId = userResult.rows[0].id;
        }
        else {
            userId = existingUser.rows[0].id;
        }
        // Owner of this specific org either way — it's their store, regardless of
        // whether they already own a different GenSmart organization elsewhere.
        await client.query(`INSERT INTO user_organizations (user_id, organization_id, role, created_at)
       VALUES ($1, $2, 'owner', NOW())
       ON CONFLICT (user_id, organization_id) DO NOTHING`, [userId, organizationId]);
        await client.query('COMMIT');
        return { userId, organizationId, isNewUser };
    }
    catch (err) {
        await client.query('ROLLBACK');
        if (err && typeof err === 'object' && 'code' in err && err.code === '23505') {
            throw new errorHandler_1.AppError(409, 'Organization slug collision, please retry', 'ORG_SLUG_TAKEN');
        }
        throw err;
    }
    finally {
        client.release();
    }
}
/**
 * Generate a one-time passwordless access token scoped to one specific
 * (user, organization) pair and email it. Unlike `forgotPassword`, the
 * consuming endpoint never asks for a password — it logs the user straight
 * into that organization.
 */
async function generateOrgAccessToken(userId, organizationId) {
    const token = crypto_1.default.randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await (0, database_1.query)(`INSERT INTO org_access_tokens (id, user_id, organization_id, token_hash, expires_at, created_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())`, [userId, organizationId, tokenHash, expiresAt.toISOString()]);
    return token;
}
async function sendOrgAccessLinkEmail(userId, organizationId, storeName) {
    const userResult = await (0, database_1.query)('SELECT email, name FROM users WHERE id = $1', [userId]);
    const user = userResult.rows[0];
    if (!user)
        throw new errorHandler_1.AppError(404, 'User not found', 'USER_NOT_FOUND');
    const token = await generateOrgAccessToken(userId, organizationId);
    // Fire-and-forget, matching sendWelcomeEmail/forgotPassword: a transient
    // SMTP failure must not roll back provisioning (org/agent/MCP already
    // exist by the time this runs) or block the caller's response.
    (0, email_1.sendOrgAccessEmail)({ name: user.name, email: user.email }, storeName, token).catch((err) => console.error('[Email] Failed to send org access email:', err));
}
/**
 * Consume a passwordless org-access token and return full session tokens
 * scoped to the organization the link was generated for — which may differ
 * from the user's `users.organization_id` (their other, primary org). Reads
 * the effective role from `user_organizations` for that specific org.
 */
async function consumeOrgAccessToken(token) {
    const tokenHash = hashToken(token);
    const tokenResult = await (0, database_1.query)(`SELECT id, user_id, organization_id, used, expires_at
     FROM org_access_tokens WHERE token_hash = $1`, [tokenHash]);
    const tokenRow = tokenResult.rows[0];
    if (!tokenRow || tokenRow.used || new Date(tokenRow.expires_at) < new Date()) {
        throw new errorHandler_1.AppError(400, 'Invalid or expired access token', 'INVALID_ACCESS_TOKEN');
    }
    const membershipResult = await (0, database_1.query)('SELECT role FROM user_organizations WHERE user_id = $1 AND organization_id = $2', [tokenRow.user_id, tokenRow.organization_id]);
    const membership = membershipResult.rows[0];
    if (!membership) {
        throw new errorHandler_1.AppError(403, 'User is not a member of this organization', 'NOT_A_MEMBER');
    }
    const userResult = await (0, database_1.query)(`SELECT u.id, u.email, u.name, u.role, u.organization_id, u.password_hash,
            u.totp_enabled, u.totp_secret_encrypted, u.last_login_at, u.language,
            u.onboarding_completed, u.onboarding_step, u.editor_tour_completed, u.is_super_admin
     FROM users u WHERE u.id = $1`, [tokenRow.user_id]);
    const user = userResult.rows[0];
    if (!user)
        throw new errorHandler_1.AppError(404, 'User not found', 'USER_NOT_FOUND');
    const orgResult = await (0, database_1.query)('SELECT id, name FROM organizations WHERE id = $1', [tokenRow.organization_id]);
    const org = orgResult.rows[0];
    if (!org)
        throw new errorHandler_1.AppError(404, 'Organization not found', 'ORG_NOT_FOUND');
    await (0, database_1.query)('UPDATE org_access_tokens SET used = true WHERE id = $1', [tokenRow.id]);
    await (0, database_1.query)('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);
    // Override organization_id/role with the token's target org — not the
    // user's `users.organization_id`, which may point at a different org.
    const targetUser = {
        ...user,
        organization_id: tokenRow.organization_id,
        role: membership.role,
    };
    return buildAuthTokens(targetUser, org);
}
async function disable2FA(userId, password) {
    const result = await (0, database_1.query)('SELECT password_hash FROM users WHERE id = $1', [userId]);
    const user = result.rows[0];
    if (!user) {
        throw new errorHandler_1.AppError(404, 'User not found', 'USER_NOT_FOUND');
    }
    const passwordMatch = await bcryptjs_1.default.compare(password, user.password_hash);
    if (!passwordMatch) {
        throw new errorHandler_1.AppError(401, 'Invalid password', 'INVALID_PASSWORD');
    }
    await (0, database_1.query)(`UPDATE users SET totp_enabled = false, totp_secret_encrypted = NULL, updated_at = NOW() WHERE id = $1`, [userId]);
    await (0, database_1.query)('DELETE FROM backup_codes WHERE user_id = $1', [userId]);
}
//# sourceMappingURL=auth.service.js.map