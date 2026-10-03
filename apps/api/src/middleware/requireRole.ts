import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { isRoleAllowed } from '../services/access-rules';

/**
 * Allows the request only when the authenticated user's role is in the list.
 * Must run after requireAuth. The role comes from the JWT (may lag up to the token lifetime).
 */
export function requireRole(...roles: string[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!isRoleAllowed(req.user?.role, roles)) {
      res.status(403).json({ error: { message: 'Insufficient permissions', code: 'FORBIDDEN' } });
      return;
    }
    next();
  };
}
