"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startScoringWorker = startScoringWorker;
const bullmq_1 = require("bullmq");
const queues_1 = require("../config/queues");
const ai_scoring_service_1 = require("../services/ai-scoring.service");
const database_1 = require("../config/database");
const websocket_1 = require("../config/websocket");
const notification_service_1 = require("../services/notification.service");
async function processScoring(job) {
    const { conversationId, organizationId, trigger } = job.data;
    console.log(`[scoring-worker] Scoring conversation ${conversationId} (trigger: ${trigger})`);
    let result;
    try {
        result = await (0, ai_scoring_service_1.scoreConversation)(conversationId, organizationId);
    }
    catch (err) {
        console.error(`[scoring-worker] Scoring failed for ${conversationId}:`, err.message);
        return;
    }
    // Fetch updated contact info for WS event
    const convResult = await (0, database_1.query)(`SELECT c.contact_id, co.funnel_stage
     FROM conversations c
     LEFT JOIN contacts co ON c.contact_id = co.id
     WHERE c.id = $1`, [conversationId]);
    const conv = convResult.rows[0];
    const contactId = conv?.contact_id;
    // Emit WebSocket event
    try {
        (0, websocket_1.getIO)().to(`org:${organizationId}`).emit('contact:scored', {
            contactId,
            conversationId,
            score: result.score,
            summary: result.summary,
            service: result.service,
            funnelStage: conv?.funnel_stage,
        });
    }
    catch {
        // WebSocket might not be initialized in tests
    }
    console.log(`[scoring-worker] Scored conversation ${conversationId}: score=${result.score}, service=${result.service}`);
    // Notify all org members when a high-score lead is detected
    if (result.score >= 8) {
        (0, notification_service_1.createNotification)({
            organizationId,
            type: 'high_score_lead',
            title: `High-Score Lead: ${result.summary?.substring(0, 50) || 'New high-value lead'}`,
            message: `Contact scored ${result.score}/10. Service: ${result.service}`,
            data: {
                contactId: contactId ?? undefined,
                conversationId,
                score: result.score,
                service: result.service,
            },
            sendEmail: true,
        }).catch((err) => console.error('[scoring-worker] Failed to create notification:', err));
    }
}
function startScoringWorker() {
    const worker = new bullmq_1.Worker('ai-scoring', processScoring, {
        connection: (0, queues_1.createBullConnection)(),
        concurrency: 3,
    });
    worker.on('completed', (job) => {
        console.log(`[scoring-worker] Job ${job.id} completed`);
    });
    worker.on('failed', (job, err) => {
        console.error(`[scoring-worker] Job ${job?.id} failed:`, err);
    });
    return worker;
}
//# sourceMappingURL=scoring.worker.js.map