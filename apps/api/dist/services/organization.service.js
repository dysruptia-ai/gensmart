"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrganization = getOrganization;
exports.updateOrganization = updateOrganization;
exports.getMembers = getMembers;
exports.inviteMember = inviteMember;
exports.updateMemberRole = updateMemberRole;
exports.removeMember = removeMember;
const crypto_1 = __importDefault(require("crypto"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const database_1 = require("../config/database");
const errorHandler_1 = require("../middleware/errorHandler");
const email_1 = require("../config/email");
async function getOrganization(orgId) {
    const result = await (0, database_1.query)(`SELECT o.id, o.name, o.slug, o.plan, o.subscription_status,
            COALESCE(o.settings, '{}')::json as settings, o.created_at,
            o.trial_ends_at,
            COUNT(u.id)::int as member_count
     FROM organizations o
     LEFT JOIN users u ON u.organization_id = o.id
     WHERE o.id = $1
     GROUP BY o.id`, [orgId]);
    const org = result.rows[0];
    if (!org)
        throw new errorHandler_1.AppError(404, 'Organization not found', 'ORG_NOT_FOUND');
    return org;
}
async function updateOrganization(orgId, data) {
    const sets = [];
    const params = [];
    let idx = 1;
    if (data.name !== undefined) {
        sets.push(`name = $${idx++}`);
        params.push(data.name);
    }
    if (data.settings !== undefined) {
        // Merge into existing settings (|| operator in PostgreSQL JSONB merges top-level keys)
        sets.push(`settings = COALESCE(settings, '{}'::jsonb) || $${idx++}::jsonb`);
        params.push(JSON.stringify(data.settings));
    }
    if (sets.length === 0) {
        return getOrganization(orgId);
    }
    sets.push(`updated_at = NOW()`);
    params.push(orgId);
    await (0, database_1.query)(`UPDATE organizations SET ${sets.join(', ')} WHERE id = $${idx}`, params);
    return getOrganization(orgId);
}
async function getMembers(orgId) {
    const result = await (0, database_1.query)(`SELECT id, name, email, role, avatar_url, created_at
     FROM users
     WHERE organization_id = $1
     ORDER BY created_at ASC`, [orgId]);
    return result.rows;
}
async function inviteMember(orgId, inviterId, data) {
    // Check if already a member
    const existing = await (0, database_1.query)('SELECT id FROM users WHERE email = $1 AND organization_id = $2', [data.email.toLowerCase(), orgId]);
    if (existing.rows.length > 0) {
        throw new errorHandler_1.AppError(409, 'User is already a member of this organization', 'ALREADY_MEMBER');
    }
    // Check email is not used in another org
    const otherOrg = await (0, database_1.query)('SELECT id FROM users WHERE email = $1', [data.email.toLowerCase()]);
    if (otherOrg.rows.length > 0) {
        throw new errorHandler_1.AppError(409, 'This email is already registered. Ask the user to contact support.', 'EMAIL_IN_USE');
    }
    // Get org info for the email
    const orgResult = await (0, database_1.query)('SELECT name FROM organizations WHERE id = $1', [orgId]);
    const org = orgResult.rows[0];
    const inviterResult = await (0, database_1.query)('SELECT name FROM users WHERE id = $1', [inviterId]);
    const inviter = inviterResult.rows[0];
    // Generate a setup token (acts as a password reset token for the new user)
    const token = crypto_1.default.randomBytes(32).toString('hex');
    const tokenHash = crypto_1.default.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    // Create invited user with temporary password hash
    const tempPasswordHash = await bcryptjs_1.default.hash(crypto_1.default.randomBytes(16).toString('hex'), 10);
    const userResult = await (0, database_1.query)(`INSERT INTO users (id, organization_id, email, name, password_hash, role, email_verified, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, false, NOW(), NOW())
     RETURNING id`, [orgId, data.email.toLowerCase(), data.email.split('@')[0], tempPasswordHash, data.role]);
    await (0, database_1.query)(`INSERT INTO password_resets (id, user_id, token_hash, expires_at, created_at)
     VALUES (gen_random_uuid(), $1, $2, $3, NOW())`, [userResult.rows[0].id, tokenHash, expiresAt.toISOString()]);
    (0, email_1.sendInvitationEmail)(inviter?.name ?? 'A teammate', data.email, org?.name ?? 'GenSmart', token).catch((err) => console.error('[Email] Failed to send invitation:', err));
}
async function updateMemberRole(orgId, requesterId, targetUserId, newRole) {
    const requester = await (0, database_1.query)('SELECT role FROM users WHERE id = $1 AND organization_id = $2', [requesterId, orgId]);
    if (requester.rows[0]?.role !== 'owner') {
        throw new errorHandler_1.AppError(403, 'Only the owner can change member roles', 'FORBIDDEN');
    }
    const target = await (0, database_1.query)('SELECT role, id FROM users WHERE id = $1 AND organization_id = $2', [targetUserId, orgId]);
    if (!target.rows[0]) {
        throw new errorHandler_1.AppError(404, 'Member not found', 'MEMBER_NOT_FOUND');
    }
    if (target.rows[0].role === 'owner') {
        throw new errorHandler_1.AppError(400, 'Cannot change the owner\'s role', 'CANNOT_CHANGE_OWNER');
    }
    await (0, database_1.query)('UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2', [newRole, targetUserId]);
}
async function removeMember(orgId, requesterId, targetUserId) {
    const requester = await (0, database_1.query)('SELECT role FROM users WHERE id = $1 AND organization_id = $2', [requesterId, orgId]);
    if (!['owner', 'admin'].includes(requester.rows[0]?.role ?? '')) {
        throw new errorHandler_1.AppError(403, 'Only owners and admins can remove members', 'FORBIDDEN');
    }
    const target = await (0, database_1.query)('SELECT role FROM users WHERE id = $1 AND organization_id = $2', [targetUserId, orgId]);
    if (!target.rows[0]) {
        throw new errorHandler_1.AppError(404, 'Member not found', 'MEMBER_NOT_FOUND');
    }
    if (target.rows[0].role === 'owner') {
        throw new errorHandler_1.AppError(400, 'Cannot remove the organization owner', 'CANNOT_REMOVE_OWNER');
    }
    if (requesterId === targetUserId) {
        throw new errorHandler_1.AppError(400, 'Cannot remove yourself', 'CANNOT_REMOVE_SELF');
    }
    await (0, database_1.query)('DELETE FROM users WHERE id = $1', [targetUserId]);
}
//# sourceMappingURL=organization.service.js.map