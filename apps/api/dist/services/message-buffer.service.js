"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pushToBuffer = pushToBuffer;
exports.flushBuffer = flushBuffer;
const redis_1 = require("../config/redis");
const queues_1 = require("../config/queues");
const BUFFER_PREFIX = 'buffer:';
const JOB_KEY_PREFIX = 'job_id:';
async function pushToBuffer(conversationId, agentId, organizationId, message, bufferSeconds) {
    const bufferKey = `${BUFFER_PREFIX}${conversationId}`;
    const jobKey = `${JOB_KEY_PREFIX}${conversationId}`;
    // Serialize: if string, wrap as text BufferItem for uniform handling
    const item = typeof message === 'string'
        ? { type: 'text', content: message }
        : message;
    // Push JSON to Redis list
    await redis_1.redis.rpush(bufferKey, JSON.stringify(item));
    // Ensure buffer expires (safety net)
    await redis_1.redis.expire(bufferKey, Math.max(bufferSeconds * 3, 300));
    // Cancel existing delayed job if present
    const existingJobId = await redis_1.redis.get(jobKey);
    if (existingJobId) {
        try {
            const existingJob = await queues_1.messageQueue.getJob(existingJobId);
            if (existingJob) {
                await existingJob.remove();
            }
        }
        catch {
            // Job may have already executed — ignore
        }
        await redis_1.redis.del(jobKey);
    }
    // Enqueue new delayed job (resets the timer)
    const job = await queues_1.messageQueue.add('process-message', { conversationId, agentId, organizationId }, {
        delay: bufferSeconds * 1000,
        jobId: `msg-${conversationId}-${Date.now()}`,
    });
    if (job.id) {
        await redis_1.redis.set(jobKey, job.id, 'EX', bufferSeconds * 2 + 120);
    }
}
async function flushBuffer(conversationId) {
    const bufferKey = `${BUFFER_PREFIX}${conversationId}`;
    const jobKey = `${JOB_KEY_PREFIX}${conversationId}`;
    // Atomically read and delete
    const pipeline = redis_1.redis.pipeline();
    pipeline.lrange(bufferKey, 0, -1);
    pipeline.del(bufferKey);
    pipeline.del(jobKey);
    const results = await pipeline.exec();
    const raw = results?.[0]?.[1] ?? [];
    // Parse JSON items, with backward compat for plain strings (from old buffer entries)
    return raw.map((str) => {
        try {
            const parsed = JSON.parse(str);
            if (parsed.type === 'text' || parsed.type === 'image')
                return parsed;
            return { type: 'text', content: str };
        }
        catch {
            return { type: 'text', content: str };
        }
    });
}
//# sourceMappingURL=message-buffer.service.js.map