import { Request, Response, NextFunction } from 'express';

/**
 * Middleware that checks if the authenticated user is a super admin.
 * MUST be used AFTER requireAuth middleware.
 */
export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user?.isSuperAdmin) {
    res.status(403).json({ error: { message: 'Forbidden: Super admin access required', code: 'FORBIDDEN' } });
    return;
  }
  next();
}
