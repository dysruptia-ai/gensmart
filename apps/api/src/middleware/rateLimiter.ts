import { Request, Response, NextFunction } from 'express';
import { redis } from '../config/redis';

interface RateLimitOptions {
  windowSeconds: number;
  maxRequests: number;
  keyPrefix?: string;
  /** Key used instead of the IP (e.g. the user id). Returning null falls back to the IP. */
  keyFn?: (req: Request) => string | null;
  /** When Redis fails, answer 503 instead of letting the request through. */
  failClosed?: boolean;
  message?: string;
}

export function rateLimiter(options: RateLimitOptions) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const subject = options.keyFn?.(req) ?? ip;
    const key = `ratelimit:${options.keyPrefix ?? 'default'}:${subject}`;

    try {
      const current = await redis.incr(key);
      if (current === 1) {
        await redis.expire(key, options.windowSeconds);
      }

      if (current > options.maxRequests) {
        res.status(429).json({
          error: {
            message: options.message ?? 'Too many requests, please try again later',
            code: 'RATE_LIMIT_EXCEEDED',
          },
        });
        return;
      }

      next();
    } catch {
      if (options.failClosed) {
        res.status(503).json({
          error: { message: 'Service temporarily unavailable', code: 'RATE_LIMIT_UNAVAILABLE' },
        });
        return;
      }
      // If Redis fails, allow request through
      next();
    }
  };
}
