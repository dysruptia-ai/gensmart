import { redis } from '../config/redis';
import { messageQueue } from '../config/queues';

const BUFFER_PREFIX = 'buffer:';
const JOB_KEY_PREFIX = 'job_id:';

export interface BufferItem {
  type: 'text' | 'image';
  content: string;           // text content for 'text', caption for 'image'
  mimeType?: string;         // only for 'image': 'image/jpeg', etc.
  data?: string;             // only for 'image': base64 data
}

export async function pushToBuffer(
  conversationId: string,
  agentId: string,
  organizationId: string,
  message: string | BufferItem,
  bufferSeconds: number
): Promise<void> {
  const bufferKey = `${BUFFER_PREFIX}${conversationId}`;
  const jobKey = `${JOB_KEY_PREFIX}${conversationId}`;

  // Serialize: if string, wrap as text BufferItem for uniform handling
  const item: BufferItem = typeof message === 'string'
    ? { type: 'text', content: message }
    : message;

  // Push JSON to Redis list
  await redis.rpush(bufferKey, JSON.stringify(item));
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

export async function flushBuffer(conversationId: string): Promise<BufferItem[]> {
  const bufferKey = `${BUFFER_PREFIX}${conversationId}`;
  const jobKey = `${JOB_KEY_PREFIX}${conversationId}`;

  // Atomically read and delete
  const pipeline = redis.pipeline();
  pipeline.lrange(bufferKey, 0, -1);
  pipeline.del(bufferKey);
  pipeline.del(jobKey);
  const results = await pipeline.exec();

  const raw = (results?.[0]?.[1] as string[] | null) ?? [];

  // Parse JSON items, with backward compat for plain strings (from old buffer entries)
  return raw.map((str) => {
    try {
      const parsed = JSON.parse(str) as BufferItem;
      if (parsed.type === 'text' || parsed.type === 'image') return parsed;
      return { type: 'text' as const, content: str };
    } catch {
      return { type: 'text' as const, content: str };
    }
  });
}
