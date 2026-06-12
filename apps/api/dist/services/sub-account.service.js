"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSubAccounts = getSubAccounts;
exports.createSubAccount = createSubAccount;
exports.removeSubAccount = removeSubAccount;
exports.switchToSubAccount = switchToSubAccount;
const database_1 = require("../config/database");
const errorHandler_1 = require("../middleware/errorHandler");
const jwt_1 = require("../config/jwt");
const shared_1 = require("@gensmart/shared");
function slugify(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}
async function getSubAccounts(parentOrgId) {
    const result = await (0, database_1.query)(`SELECT sa.id, sa.parent_organization_id, sa.child_organization_id, sa.label, sa.created_at,
            o.name as org_name, o.plan as org_plan
     FROM sub_accounts sa
     JOIN organizations o ON o.id = sa.child_organization_id
     WHERE sa.parent_organization_id = $1
     ORDER BY sa.created_at ASC`, [parentOrgId]);
    return result.rows.map((row) => ({
        id: row.id,
        childOrgId: row.child_organization_id,
        label: row.label,
        name: row.org_name,
        plan: row.org_plan,
        created_at: row.created_at,
    }));
}
async function createSubAccount(parentOrgId, data) {
    // Check plan limit
    const orgResult = await (0, database_1.query)('SELECT plan FROM organizations WHERE id = $1', [parentOrgId]);
    const plan = orgResult.rows[0]?.plan;
    const limit = shared_1.PLAN_LIMITS[plan]?.subAccounts ?? 0;
    const existing = await (0, database_1.query)('SELECT COUNT(*)::int as count FROM sub_accounts WHERE parent_organization_id = $1', [parentOrgId]);
    const currentCount = parseInt(existing.rows[0]?.count ?? '0', 10);
    if (limit !== Infinity && currentCount >= limit) {
        throw new errorHandler_1.AppError(403, `Your plan allows up to ${limit} sub-account(s). Please upgrade to add more.`, 'PLAN_LIMIT_EXCEEDED');
    }
    const slug = slugify(data.name);
    const childOrgResult = await (0, database_1.query)(`INSERT INTO organizations (id, name, slug, plan, subscription_status, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, 'free', 'active', NOW(), NOW())
     RETURNING id, name, plan, slug`, [data.name, slug]);
    const childOrg = childOrgResult.rows[0];
    const subAccResult = await (0, database_1.query)(`INSERT INTO sub_accounts (id, parent_organization_id, child_organization_id, label, created_at)
     VALUES (gen_random_uuid(), $1, $2, $3, NOW())
     RETURNING id, parent_organization_id, child_organization_id, label, created_at`, [parentOrgId, childOrg.id, data.label]);
    const subAcc = subAccResult.rows[0];
    return {
        id: subAcc.id,
        childOrgId: childOrg.id,
        label: subAcc.label,
        name: childOrg.name,
        plan: childOrg.plan,
        created_at: subAcc.created_at,
    };
}
async function removeSubAccount(parentOrgId, childOrgId) {
    const existing = await (0, database_1.query)('SELECT id FROM sub_accounts WHERE parent_organization_id = $1 AND child_organization_id = $2', [parentOrgId, childOrgId]);
    if (!existing.rows[0]) {
        throw new errorHandler_1.AppError(404, 'Sub-account not found', 'SUB_ACCOUNT_NOT_FOUND');
    }
    await (0, database_1.query)('DELETE FROM sub_accounts WHERE parent_organization_id = $1 AND child_organization_id = $2', [parentOrgId, childOrgId]);
}
async function switchToSubAccount(userId, userEmail, userRole, parentOrgId, childOrgId) {
    // Verify the link exists
    const link = await (0, database_1.query)('SELECT id FROM sub_accounts WHERE parent_organization_id = $1 AND child_organization_id = $2', [parentOrgId, childOrgId]);
    if (!link.rows[0]) {
        throw new errorHandler_1.AppError(403, 'Not authorized to switch to this account', 'FORBIDDEN');
    }
    const accessToken = (0, jwt_1.generateAccessToken)({
        userId,
        orgId: childOrgId,
        role: userRole,
        email: userEmail,
    });
    return { accessToken };
}
//# sourceMappingURL=sub-account.service.js.map