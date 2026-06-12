import { Request, Response, NextFunction } from 'express';
export interface JwtPayload {
    userId: string;
    orgId: string;
    role: string;
    email: string;
    isSuperAdmin?: boolean;
}
declare global {
    namespace Express {
        interface Request {
            user?: JwtPayload;
        }
    }
}
export declare function requireAuth(req: Request, res: Response, next: NextFunction): void;
//# sourceMappingURL=auth.d.ts.map