import { Request, Response, NextFunction } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Blocks mutation routes for an org whose trial expired or whose subscription was cancelled.
 * Not a plan-limit check — `is_suspended` is a billing-state gate independent of `plan`, so the org
 * keeps knowing what it was paying for. Safe methods (reads) always pass through, so this can be
 * mounted once per router via `router.use(requireAuth, orgContext, requireActiveSubscription())`
 * without blocking GETs — never mount it on billing.ts, account.ts or conversations.ts (see the
 * suspension design notes: billing must stay reachable to reactivate, GDPR rights and human-sent
 * conversation replies are intentionally out of scope).
 */
export function requireActiveSubscription() {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (SAFE_METHODS.has(req.method)) {
      next();
      return;
    }
    if (req.org?.is_suspended) {
      res.status(403).json({
        error: {
          message: 'Organization is suspended. Reactivate your subscription to continue.',
          code: 'ORG_SUSPENDED',
        },
      });
      return;
    }
    next();
  };
}
