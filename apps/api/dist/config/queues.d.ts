import { Queue } from 'bullmq';
import IORedis from 'ioredis';
declare function createBullConnection(): IORedis;
export declare const messageQueue: Queue<any, any, string, any, any, string>;
export declare const ragQueue: Queue<any, any, string, any, any, string>;
export declare const scrapingQueue: Queue<any, any, string, any, any, string>;
export declare const scoringQueue: Queue<any, any, string, any, any, string>;
export declare const exportQueue: Queue<any, any, string, any, any, string>;
export declare const mcpWebhookQueue: Queue<any, any, string, any, any, string>;
export { createBullConnection };
//# sourceMappingURL=queues.d.ts.map