import { Request, Response, NextFunction } from 'express';
export declare class AppError extends Error {
    statusCode: number;
    message: string;
    code?: string | undefined;
    details?: Record<string, unknown> | undefined;
    constructor(statusCode: number, message: string, code?: string | undefined, details?: Record<string, unknown> | undefined);
}
export declare function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void;
//# sourceMappingURL=errorHandler.d.ts.map