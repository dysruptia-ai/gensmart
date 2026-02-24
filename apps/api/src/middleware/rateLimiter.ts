import { Request, Response, NextFunction } from 'express';
import { redis } from '../config/redis';

interface RateLimitOptions {
  windowSeconds: number;
  maxRequests: number;
  keyPrefix?: string;
}

export function rateLimiter(options: RateLimitOptions) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const key = `ratelimit:${options.keyPrefix ?? 'default'}:${ip}`;

    try {
      const current = await redis.incr(key);
      if (current === 1) {
        await redis.expire(key, options.windowSeconds);
      }

      if (current > options.maxRequests) {
        res.status(429).json({
          error: {
            message: 'Too many requests, please try again later',
            code: 'RATE_LIMIT_EXCEEDED',
          },
        });
        return;
      }

      next();
    } catch {
      // If Redis fails, allow request through
      next();
    }
  };
}
