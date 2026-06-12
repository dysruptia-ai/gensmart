"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mcpWebhookQueue = exports.exportQueue = exports.scoringQueue = exports.scrapingQueue = exports.ragQueue = exports.messageQueue = void 0;
exports.createBullConnection = createBullConnection;
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const env_1 = require("./env");
function createBullConnection() {
    return new ioredis_1.default(env_1.env.REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        retryStrategy(times) {
            if (times > 10)
                return null;
            return Math.min(times * 100, 3000);
        },
    });
}
exports.messageQueue = new bullmq_1.Queue('message-processing', {
    connection: createBullConnection(),
    defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
    },
});
exports.ragQueue = new bullmq_1.Queue('rag-processing', {
    connection: createBullConnection(),
    defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
    },
});
exports.scrapingQueue = new bullmq_1.Queue('scraping-processing', {
    connection: createBullConnection(),
    defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
    },
});
exports.scoringQueue = new bullmq_1.Queue('ai-scoring', {
    connection: createBullConnection(),
    defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
    },
});
exports.exportQueue = new bullmq_1.Queue('data-export', {
    connection: createBullConnection(),
    defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 25,
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 },
    },
});
// Inbound MCP webhook processing (signature already verified by the endpoint;
// the worker fetches the conversation, formats the message and notifies the
// channel). 3 attempts with exponential backoff so a transient WhatsApp/DB
// failure doesn't drop the event.
exports.mcpWebhookQueue = new bullmq_1.Queue('mcp-webhook-processing', {
    connection: createBullConnection(),
    defaultJobOptions: {
        removeOnComplete: 200,
        removeOnFail: 100,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
    },
});
//# sourceMappingURL=queues.js.map