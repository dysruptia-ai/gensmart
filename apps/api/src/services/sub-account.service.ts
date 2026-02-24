import { query } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { generateAccessToken } from '../config/jwt';
import { PLAN_LIMITS } from '@gensmart/shared';

interface SubAccountRow {
  id: string;
  parent_organization_id: string;
  child_organization_id: string;
  label: string;
  created_at: string;
}

interface OrgRow {
  id: string;
  name: string;
  plan: string;
  slug: string;
}

interface SubAccountData {
  id: string;
  childOrgId: string;
  label: string;
  name: string;
  plan: string;
  created_at: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function getSubAccounts(parentOrgId: string): Promise<SubAccountData[]> {
  const result = await query<SubAccountRow & { org_name: string; org_plan: string }>(
    `SELECT sa.id, sa.parent_organization_id, sa.child_organization_id, sa.label, sa.created_at,
            o.name as org_name, o.plan as org_plan
     FROM sub_accounts sa
     JOIN organizations o ON o.id = sa.child_organization_id
     WHERE sa.parent_organization_id = $1
     ORDER BY sa.created_at ASC`,
    [parentOrgId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    childOrgId: row.child_organization_id,
    label: row.label,
    name: row.org_name,
    plan: row.org_plan,
    created_at: row.created_at,
  }));
}

export async function createSubAccount(
  parentOrgId: string,
  data: { name: string; label: string }
): Promise<SubAccountData> {
  // Check plan limit
  const orgResult = await query<OrgRow>(
    'SELECT plan FROM organizations WHERE id = $1',
    [parentOrgId]
  );
  const plan = orgResult.rows[0]?.plan as keyof typeof PLAN_LIMITS;
  const limit = PLAN_LIMITS[plan]?.subAccounts ?? 0;

  const existing = await query<{ count: string }>(
    'SELECT COUNT(*)::int as count FROM sub_accounts WHERE parent_organization_id = $1',
    [parentOrgId]
  );
  const currentCount = parseInt(existing.rows[0]?.count ?? '0', 10);

  if (limit !== Infinity && currentCount >= limit) {
    throw new AppError(
      403,
      `Your plan allows up to ${limit} sub-account(s). Please upgrade to add more.`,
      'PLAN_LIMIT_EXCEEDED'
    );
  }

  const slug = slugify(data.name);
  const childOrgResult = await query<OrgRow>(
    `INSERT INTO organizations (id, name, slug, plan, subscription_status, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, 'free', 'active', NOW(), NOW())
     RETURNING id, name, plan, slug`,
    [data.name, slug]
  );
  const childOrg = childOrgResult.rows[0];

  const subAccResult = await query<SubAccountRow>(
    `INSERT INTO sub_accounts (id, parent_organization_id, child_organization_id, label, created_at)
     VALUES (gen_random_uuid(), $1, $2, $3, NOW())
     RETURNING id, parent_organization_id, child_organization_id, label, created_at`,
    [parentOrgId, childOrg.id, data.label]
  );
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

export async function removeSubAccount(parentOrgId: string, childOrgId: string): Promise<void> {
  const existing = await query<{ id: string }>(
    'SELECT id FROM sub_accounts WHERE parent_organization_id = $1 AND child_organization_id = $2',
    [parentOrgId, childOrgId]
  );
  if (!existing.rows[0]) {
    throw new AppError(404, 'Sub-account not found', 'SUB_ACCOUNT_NOT_FOUND');
  }
  await query(
    'DELETE FROM sub_accounts WHERE parent_organization_id = $1 AND child_organization_id = $2',
    [parentOrgId, childOrgId]
  );
}

export async function switchToSubAccount(
  userId: string,
  userEmail: string,
  userRole: string,
  parentOrgId: string,
  childOrgId: string
): Promise<{ accessToken: string }> {
  // Verify the link exists
  const link = await query<{ id: string }>(
    'SELECT id FROM sub_accounts WHERE parent_organization_id = $1 AND child_organization_id = $2',
    [parentOrgId, childOrgId]
  );
  if (!link.rows[0]) {
    throw new AppError(403, 'Not authorized to switch to this account', 'FORBIDDEN');
  }

  const accessToken = generateAccessToken({
    userId,
    orgId: childOrgId,
    role: userRole,
    email: userEmail,
  });

  return { accessToken };
}
