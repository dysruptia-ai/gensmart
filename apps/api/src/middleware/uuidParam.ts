import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';
import { isUuid } from '../services/widget-input';

/**
 * 404 (AppError format) when the route param is not a UUID, before anything reaches the database.
 * Mount on a path prefix, e.g. router.use('/organizations/:id', requireUuidParam('id', 'Organization not found')):
 * it covers that path and its sub-routes only (other :id params, like MCP provider slugs, are untouched).
 */
export function requireUuidParam(name: string, notFoundMessage: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (isUuid(req.params[name])) {
      next();
      return;
    }
    next(new AppError(404, notFoundMessage, 'NOT_FOUND'));
  };
}
