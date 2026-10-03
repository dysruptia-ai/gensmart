import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { query, getClient } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { sendInvitationEmail } from '../config/email';
import { canInviteRole } from './access-rules';

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
  trial_ends_at: string | null;
}

export async function getOrganization(orgId: string): Promise<OrganizationData> {
  const result = await query<OrganizationData>(
    `SELECT o.id, o.name, o.slug, o.plan, o.subscription_status,
            COALESCE(o.settings, '{}')::json as settings, o.created_at,
            o.trial_ends_at,
            (SELECT COUNT(*)::int FROM user_organizations uo WHERE uo.organization_id = o.id) as member_count
     FROM organizations o
     WHERE o.id = $1`,
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
    // Merge into existing settings (|| operator in PostgreSQL JSONB merges top-level keys)
    sets.push(`settings = COALESCE(settings, '{}'::jsonb) || $${idx++}::jsonb`);
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
    `SELECT u.id, u.name, u.email, uo.role, u.avatar_url, u.created_at
     FROM user_organizations uo
     JOIN users u ON u.id = uo.user_id
     WHERE uo.organization_id = $1
     ORDER BY uo.created_at ASC`,
    [orgId]
  );
  return result.rows;
}

export async function inviteMember(
  orgId: string,
  inviterId: string,
  data: { email: string; role: string }
): Promise<void> {
  // The inviter's role is read from the database (membership first, primary user row as fallback)
  const membership = await query<{ role: string }>(
    'SELECT role FROM user_organizations WHERE user_id = $1 AND organization_id = $2',
    [inviterId, orgId]
  );
  let inviterRole: string | undefined = membership.rows[0]?.role;
  if (!inviterRole) {
    const fallback = await query<{ role: string }>(
      'SELECT role FROM users WHERE id = $1 AND organization_id = $2',
      [inviterId, orgId]
    );
    inviterRole = fallback.rows[0]?.role;
  }
  if (inviterRole !== 'owner' && inviterRole !== 'admin') {
    throw new AppError(403, 'Only owners and admins can invite members', 'FORBIDDEN');
  }
  if (!canInviteRole(inviterRole, data.role)) {
    throw new AppError(403, 'Only the owner can invite admins', 'FORBIDDEN');
  }

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

  // The three inserts succeed or fail together: no user without membership or setup token is left behind
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const userResult = await client.query<{ id: string }>(
      `INSERT INTO users (id, organization_id, email, name, password_hash, role, email_verified, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, false, NOW(), NOW())
       RETURNING id`,
      [orgId, data.email.toLowerCase(), data.email.split('@')[0], tempPasswordHash, data.role]
    );
    const newUserId = userResult.rows[0]!.id;

    await client.query(
      `INSERT INTO user_organizations (user_id, organization_id, role, created_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, organization_id) DO NOTHING`,
      [newUserId, orgId, data.role]
    );

    await client.query(
      `INSERT INTO password_resets (id, user_id, token_hash, expires_at, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, NOW())`,
      [newUserId, tokenHash, expiresAt.toISOString()]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    // Same email invited twice at the same moment: the unique index on users.email decides
    if (err && typeof err === 'object' && (err as { code?: string }).code === '23505') {
      throw new AppError(409, 'This email is already registered. Ask the user to contact support.', 'EMAIL_IN_USE');
    }
    throw err;
  } finally {
    client.release();
  }

  // After the COMMIT, and without blocking the request
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
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const requester = await client.query<{ role: string }>(
      'SELECT role FROM user_organizations WHERE user_id = $1 AND organization_id = $2',
      [requesterId, orgId]
    );
    if (requester.rows[0]?.role !== 'owner') {
      throw new AppError(403, 'Only the owner can change member roles', 'FORBIDDEN');
    }

    const target = await client.query<{ role: string }>(
      'SELECT role FROM user_organizations WHERE user_id = $1 AND organization_id = $2 FOR UPDATE',
      [targetUserId, orgId]
    );
    if (!target.rows[0]) {
      throw new AppError(404, 'Member not found', 'MEMBER_NOT_FOUND');
    }
    if (target.rows[0].role === 'owner') {
      throw new AppError(400, 'Cannot change the owner\'s role', 'CANNOT_CHANGE_OWNER');
    }

    await client.query(
      'UPDATE user_organizations SET role = $1 WHERE user_id = $2 AND organization_id = $3',
      [newRole, targetUserId, orgId]
    );
    // users.role mirrors the role in the user's primary organization only
    await client.query(
      'UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 AND organization_id = $3',
      [newRole, targetUserId, orgId]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Columns that reference users(id) without ON DELETE (all nullable, migrations 008, 014, 022, 023).
 * They are cleared before the user row is deleted so the delete cannot fail on them.
 * platform_settings.updated_by and promo_codes.created_by are only ever set by super admins,
 * who cannot be removed here.
 */
const USER_REFERENCE_COLUMNS: ReadonlyArray<{ table: string; column: string }> = [
  { table: 'agent_versions', column: 'published_by' },
  { table: 'conversations', column: 'taken_over_by' },
  { table: 'data_export_requests', column: 'requested_by' },
  { table: 'account_deletion_requests', column: 'user_id' },
];

export async function removeMember(
  orgId: string,
  requesterId: string,
  targetUserId: string
): Promise<void> {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const requester = await client.query<{ role: string }>(
      'SELECT role FROM user_organizations WHERE user_id = $1 AND organization_id = $2',
      [requesterId, orgId]
    );
    if (!['owner', 'admin'].includes(requester.rows[0]?.role ?? '')) {
      throw new AppError(403, 'Only owners and admins can remove members', 'FORBIDDEN');
    }

    const target = await client.query<{ role: string; is_super_admin: boolean | null }>(
      `SELECT uo.role, u.is_super_admin
       FROM user_organizations uo
       JOIN users u ON u.id = uo.user_id
       WHERE uo.user_id = $1 AND uo.organization_id = $2
       FOR UPDATE OF uo`,
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
    if (target.rows[0].is_super_admin) {
      throw new AppError(400, 'Cannot remove a super administrator', 'CANNOT_REMOVE_SUPER_ADMIN');
    }

    // Only drop the membership in THIS org; the user row goes away only with their last membership.
    await client.query(
      'DELETE FROM user_organizations WHERE user_id = $1 AND organization_id = $2',
      [targetUserId, orgId]
    );

    const remaining = await client.query<{ organization_id: string; role: string }>(
      'SELECT organization_id, role FROM user_organizations WHERE user_id = $1 ORDER BY created_at ASC',
      [targetUserId]
    );
    if (remaining.rows.length === 0) {
      for (const { table, column } of USER_REFERENCE_COLUMNS) {
        await client.query(`UPDATE ${table} SET ${column} = NULL WHERE ${column} = $1`, [targetUserId]);
      }
      await client.query('DELETE FROM users WHERE id = $1', [targetUserId]);
    } else {
      // Their primary organization must not stay pointing at the one that just removed them:
      // move it to their oldest remaining membership.
      const next = remaining.rows[0]!;
      await client.query(
        'UPDATE users SET organization_id = $1, role = $2, updated_at = NOW() WHERE id = $3 AND organization_id = $4',
        [next.organization_id, next.role, targetUserId, orgId]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}
