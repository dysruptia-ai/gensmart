import { Request, Response, NextFunction } from 'express';
interface RateLimitOptions {
    windowSeconds: number;
    maxRequests: number;
    keyPrefix?: string;
}
export declare function rateLimiter(options: RateLimitOptions): (req: Request, res: Response, next: NextFunction) => Promise<void>;
export {};
//# sourceMappingURL=rateLimiter.d.ts.map