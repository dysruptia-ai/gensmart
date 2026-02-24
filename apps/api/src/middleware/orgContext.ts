import { Request, Response, NextFunction } from 'express';
import { query } from '../config/database';

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
  subscription_status: string;
}

export async function orgContext(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } });
    return;
  }

  try {
    const result = await query<OrgRow>(
      'SELECT id, name, slug, plan, subscription_status FROM organizations WHERE id = $1',
      [req.user.orgId]
    );

    if (!result.rows[0]) {
      res.status(404).json({ error: { message: 'Organization not found', code: 'ORG_NOT_FOUND' } });
      return;
    }

    req.org = result.rows[0];
    next();
  } catch (err) {
    next(err);
  }
}
