import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { query } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { sendInvitationEmail } from '../config/email';

export interface OrgMember {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar_url: string | null;
  created_at: string;
}

export interface OrganizationData {
  id: string;
  name: string;
  slug: string;
  plan: string;
  subscription_status: string;
  settings: Record<string, unknown>;
  created_at: string;
  member_count: number;
}

export async function getOrganization(orgId: string): Promise<OrganizationData> {
  const result = await query<OrganizationData>(
    `SELECT o.id, o.name, o.slug, o.plan, o.subscription_status,
            COALESCE(o.settings, '{}')::json as settings, o.created_at,
            COUNT(u.id)::int as member_count
     FROM organizations o
     LEFT JOIN users u ON u.organization_id = o.id
     WHERE o.id = $1
     GROUP BY o.id`,
    [orgId]
  );
  const org = result.rows[0];
  if (!org) throw new AppError(404, 'Organization not found', 'ORG_NOT_FOUND');
  return org;
}

export async function updateOrganization(
  orgId: string,
  data: { name?: string; settings?: Record<string, unknown> }
): Promise<OrganizationData> {
  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (data.name !== undefined) {
    sets.push(`name = $${idx++}`);
    params.push(data.name);
  }
  if (data.settings !== undefined) {
    sets.push(`settings = $${idx++}::jsonb`);
    params.push(JSON.stringify(data.settings));
  }

  if (sets.length === 0) {
    return getOrganization(orgId);
  }

  sets.push(`updated_at = NOW()`);
  params.push(orgId);

  await query(`UPDATE organizations SET ${sets.join(', ')} WHERE id = $${idx}`, params);
  return getOrganization(orgId);
}

export async function getMembers(orgId: string): Promise<OrgMember[]> {
  const result = await query<OrgMember>(
    `SELECT id, name, email, role, avatar_url, created_at
     FROM users
     WHERE organization_id = $1
     ORDER BY created_at ASC`,
    [orgId]
  );
  return result.rows;
}

export async function inviteMember(
  orgId: string,
  inviterId: string,
  data: { email: string; role: string }
): Promise<void> {
  // Check if already a member
  const existing = await query<{ id: string }>(
    'SELECT id FROM users WHERE email = $1 AND organization_id = $2',
    [data.email.toLowerCase(), orgId]
  );
  if (existing.rows.length > 0) {
    throw new AppError(409, 'User is already a member of this organization', 'ALREADY_MEMBER');
  }

  // Check email is not used in another org
  const otherOrg = await query<{ id: string }>(
    'SELECT id FROM users WHERE email = $1',
    [data.email.toLowerCase()]
  );
  if (otherOrg.rows.length > 0) {
    throw new AppError(409, 'This email is already registered. Ask the user to contact support.', 'EMAIL_IN_USE');
  }

  // Get org info for the email
  const orgResult = await query<{ name: string }>('SELECT name FROM organizations WHERE id = $1', [orgId]);
  const org = orgResult.rows[0];
  const inviterResult = await query<{ name: string }>('SELECT name FROM users WHERE id = $1', [inviterId]);
  const inviter = inviterResult.rows[0];

  // Generate a setup token (acts as a password reset token for the new user)
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // Create invited user with temporary password hash
  const tempPasswordHash = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);

  const userResult = await query<{ id: string }>(
    `INSERT INTO users (id, organization_id, email, name, password_hash, role, email_verified, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, false, NOW(), NOW())
     RETURNING id`,
    [orgId, data.email.toLowerCase(), data.email.split('@')[0], tempPasswordHash, data.role]
  );

  await query(
    `INSERT INTO password_resets (id, user_id, token_hash, expires_at, created_at)
     VALUES (gen_random_uuid(), $1, $2, $3, NOW())`,
    [userResult.rows[0].id, tokenHash, expiresAt.toISOString()]
  );

  sendInvitationEmail(
    inviter?.name ?? 'A teammate',
    data.email,
    org?.name ?? 'GenSmart',
    token
  ).catch((err) => console.error('[Email] Failed to send invitation:', err));
}

export async function updateMemberRole(
  orgId: string,
  requesterId: string,
  targetUserId: string,
  newRole: string
): Promise<void> {
  const requester = await query<{ role: string }>(
    'SELECT role FROM users WHERE id = $1 AND organization_id = $2',
    [requesterId, orgId]
  );
  if (requester.rows[0]?.role !== 'owner') {
    throw new AppError(403, 'Only the owner can change member roles', 'FORBIDDEN');
  }

  const target = await query<{ role: string; id: string }>(
    'SELECT role, id FROM users WHERE id = $1 AND organization_id = $2',
    [targetUserId, orgId]
  );
  if (!target.rows[0]) {
    throw new AppError(404, 'Member not found', 'MEMBER_NOT_FOUND');
  }
  if (target.rows[0].role === 'owner') {
    throw new AppError(400, 'Cannot change the owner\'s role', 'CANNOT_CHANGE_OWNER');
  }

  await query(
    'UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2',
    [newRole, targetUserId]
  );
}

export async function removeMember(
  orgId: string,
  requesterId: string,
  targetUserId: string
): Promise<void> {
  const requester = await query<{ role: string }>(
    'SELECT role FROM users WHERE id = $1 AND organization_id = $2',
    [requesterId, orgId]
  );
  if (!['owner', 'admin'].includes(requester.rows[0]?.role ?? '')) {
    throw new AppError(403, 'Only owners and admins can remove members', 'FORBIDDEN');
  }

  const target = await query<{ role: string }>(
    'SELECT role FROM users WHERE id = $1 AND organization_id = $2',
    [targetUserId, orgId]
  );
  if (!target.rows[0]) {
    throw new AppError(404, 'Member not found', 'MEMBER_NOT_FOUND');
  }
  if (target.rows[0].role === 'owner') {
    throw new AppError(400, 'Cannot remove the organization owner', 'CANNOT_REMOVE_OWNER');
  }
  if (requesterId === targetUserId) {
    throw new AppError(400, 'Cannot remove yourself', 'CANNOT_REMOVE_SELF');
  }

  await query('DELETE FROM users WHERE id = $1', [targetUserId]);
}
