import type { Request, Response, NextFunction, RequestHandler } from 'express';

/** True when there is no Origin header (non-browser clients) or it matches an allowed origin exactly. */
export function isTrustedOrigin(origin: string | undefined, allowed: readonly string[]): boolean {
  if (origin === undefined) return true;
  return allowed.includes(origin);
}

/**
 * CSRF guard for cookie-authenticated endpoints (refresh, logout): a browser always sends Origin on a
 * cross-site POST, so a foreign page cannot trigger them.
 */
export function requireTrustedOrigin(allowed: readonly string[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.headers['origin'];
    if (!isTrustedOrigin(typeof origin === 'string' ? origin : undefined, allowed)) {
      res.status(403).json({ error: { message: 'Origin not allowed', code: 'FORBIDDEN_ORIGIN' } });
      return;
    }
    next();
  };
}
