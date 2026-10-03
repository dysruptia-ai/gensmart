import { Request, Response, NextFunction } from 'express';
import { query } from '../config/database';
import { resolveEffectiveRole } from './effective-role';

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
  subscription_status: string;
}

interface OrgMembershipRow extends OrgRow {
  member_role: string | null;
  parent_role: string | null;
}

export async function orgContext(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } });
    return;
  }

  try {
    // One query: the organization, the user's membership in it and, for a sub-account, the user's
    // membership in the parent. The token only says which organization was asked for.
    const result = await query<OrgMembershipRow>(
      `SELECT o.id, o.name, o.slug, o.plan, o.subscription_status,
              (SELECT uo.role FROM user_organizations uo
                WHERE uo.user_id = $2 AND uo.organization_id = o.id) AS member_role,
              (SELECT po.role FROM sub_accounts sa
                 JOIN user_organizations po
                   ON po.organization_id = sa.parent_organization_id AND po.user_id = $2
                WHERE sa.child_organization_id = o.id
                ORDER BY CASE po.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END
                LIMIT 1) AS parent_role
       FROM organizations o WHERE o.id = $1`,
      [req.user.orgId, req.user.userId]
    );

    const row = result.rows[0];
    if (!row) {
      res.status(404).json({ error: { message: 'Organization not found', code: 'ORG_NOT_FOUND' } });
      return;
    }

    const role = resolveEffectiveRole(row.member_role, row.parent_role);
    if (!role) {
      res.status(403).json({ error: { message: 'Not a member of this organization', code: 'NOT_A_MEMBER' } });
      return;
    }

    // requireRole and the handlers see the current role, not the one frozen in the token
    req.user.role = role;
    req.org = {
      id: row.id,
      name: row.name,
      slug: row.slug,
      plan: row.plan,
      subscription_status: row.subscription_status,
    };
    next();
  } catch (err) {
    next(err);
  }
}
