import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { env } from './env';

function createBullConnection(): IORedis {
  return new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy(times) {
      if (times > 10) return null;
      return Math.min(times * 100, 3000);
    },
  });
}

export const messageQueue = new Queue('message-processing', {
  connection: createBullConnection(),
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

export const ragQueue = new Queue('rag-processing', {
  connection: createBullConnection(),
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

export const scrapingQueue = new Queue('scraping-processing', {
  connection: createBullConnection(),
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

export const scoringQueue = new Queue('ai-scoring', {
  connection: createBullConnection(),
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

export const exportQueue = new Queue('data-export', {
  connection: createBullConnection(),
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 25,
    attempts: 2,
    backoff: { type: 'exponential', delay: 5000 },
  },
});

export { createBullConnection };
