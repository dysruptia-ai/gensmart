import { redis } from '../config/redis';
import { messageQueue } from '../config/queues';

const BUFFER_PREFIX = 'buffer:';
const JOB_KEY_PREFIX = 'job_id:';

export async function pushToBuffer(
  conversationId: string,
  agentId: string,
  organizationId: string,
  message: string,
  bufferSeconds: number
): Promise<void> {
  const bufferKey = `${BUFFER_PREFIX}${conversationId}`;
  const jobKey = `${JOB_KEY_PREFIX}${conversationId}`;

  // Push message to Redis list
  await redis.rpush(bufferKey, message);
  // Ensure buffer expires (safety net)
  await redis.expire(bufferKey, Math.max(bufferSeconds * 3, 300));

  // Cancel existing delayed job if present
  const existingJobId = await redis.get(jobKey);
  if (existingJobId) {
    try {
      const existingJob = await messageQueue.getJob(existingJobId);
      if (existingJob) {
        await existingJob.remove();
      }
    } catch {
      // Job may have already executed — ignore
    }
    await redis.del(jobKey);
  }

  // Enqueue new delayed job (resets the timer)
  const job = await messageQueue.add(
    'process-message',
    { conversationId, agentId, organizationId },
    {
      delay: bufferSeconds * 1000,
      jobId: `msg-${conversationId}-${Date.now()}`,
    }
  );

  if (job.id) {
    await redis.set(jobKey, job.id, 'EX', bufferSeconds * 2 + 120);
  }
}

export async function flushBuffer(conversationId: string): Promise<string[]> {
  const bufferKey = `${BUFFER_PREFIX}${conversationId}`;
  const jobKey = `${JOB_KEY_PREFIX}${conversationId}`;

  // Atomically read and delete
  const pipeline = redis.pipeline();
  pipeline.lrange(bufferKey, 0, -1);
  pipeline.del(bufferKey);
  pipeline.del(jobKey);
  const results = await pipeline.exec();

  return (results?.[0]?.[1] as string[] | null) ?? [];
}
