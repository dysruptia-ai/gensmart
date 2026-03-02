import { Worker, Job } from 'bullmq';
import { createBullConnection } from '../config/queues';
import { scoreConversation } from '../services/ai-scoring.service';
import { query } from '../config/database';
import { getIO } from '../config/websocket';
import { createNotification } from '../services/notification.service';

interface ScoringJobData {
  conversationId: string;
  organizationId: string;
  trigger: 'conversation_close' | 'message_threshold' | 'manual';
}

async function processScoring(job: Job<ScoringJobData>): Promise<void> {
  const { conversationId, organizationId, trigger } = job.data;

  console.log(`[scoring-worker] Scoring conversation ${conversationId} (trigger: ${trigger})`);

  let result;
  try {
    result = await scoreConversation(conversationId, organizationId);
  } catch (err) {
    console.error(`[scoring-worker] Scoring failed for ${conversationId}:`, (err as Error).message);
    return;
  }

  // Fetch updated contact info for WS event
  const convResult = await query<{ contact_id: string | null; funnel_stage?: string }>(
    `SELECT c.contact_id, co.funnel_stage
     FROM conversations c
     LEFT JOIN contacts co ON c.contact_id = co.id
     WHERE c.id = $1`,
    [conversationId]
  );
  const conv = convResult.rows[0];
  const contactId = conv?.contact_id;

  // Emit WebSocket event
  try {
    getIO().to(`org:${organizationId}`).emit('contact:scored', {
      contactId,
      conversationId,
      score: result.score,
      summary: result.summary,
      service: result.service,
      funnelStage: conv?.funnel_stage,
    });
  } catch {
    // WebSocket might not be initialized in tests
  }

  console.log(
    `[scoring-worker] Scored conversation ${conversationId}: score=${result.score}, service=${result.service}`
  );

  // Notify all org members when a high-score lead is detected
  if (result.score >= 8) {
    createNotification({
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

export function startScoringWorker(): Worker<ScoringJobData> {
  const worker = new Worker<ScoringJobData>('ai-scoring', processScoring, {
    connection: createBullConnection(),
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
