"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimiter = rateLimiter;
const redis_1 = require("../config/redis");
function rateLimiter(options) {
    return async (req, res, next) => {
        const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
        const key = `ratelimit:${options.keyPrefix ?? 'default'}:${ip}`;
        try {
            const current = await redis_1.redis.incr(key);
            if (current === 1) {
                await redis_1.redis.expire(key, options.windowSeconds);
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
        }
        catch {
            // If Redis fails, allow request through
            next();
        }
    };
}
//# sourceMappingURL=rateLimiter.js.map