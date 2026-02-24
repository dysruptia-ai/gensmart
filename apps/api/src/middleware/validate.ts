import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export function validate(schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      res.status(400).json({
        error: {
          message: 'Validation error',
          code: 'VALIDATION_ERROR',
          details: result.error.errors,
        },
      });
      return;
    }
    req[source] = result.data;
    next();
  };
}
