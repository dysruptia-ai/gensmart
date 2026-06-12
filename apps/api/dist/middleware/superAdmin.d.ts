import { Request, Response, NextFunction } from 'express';
/**
 * Middleware that checks if the authenticated user is a super admin.
 * MUST be used AFTER requireAuth middleware.
 */
export declare function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void;
//# sourceMappingURL=superAdmin.d.ts.map