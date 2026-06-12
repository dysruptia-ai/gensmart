"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const env_1 = require("./env");
exports.redis = new ioredis_1.default(env_1.env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    retryStrategy(times) {
        if (times > 10) {
            console.error('Redis connection failed after 10 retries');
            return null;
        }
        return Math.min(times * 100, 3000);
    },
});
exports.redis.on('connect', () => console.log('Redis connected'));
exports.redis.on('error', (err) => console.error('Redis error:', err));
//# sourceMappingURL=redis.js.map