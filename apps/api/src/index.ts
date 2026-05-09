import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import http from 'http';
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import Stripe from 'stripe';
import { stripe } from './config/stripe';
import { env } from './config/env';
import router from './routes/index';
import { handleWebhookEvent } from './services/stripe.service';
import { errorHandler } from './middleware/errorHandler';
import { initWebSocket } from './config/websocket';
import { startMessageWorker } from './workers/message.worker';
import { startRagWorker } from './workers/rag.worker';
import { startScrapingWorker } from './workers/scraping.worker';
import { startScoringWorker } from './workers/scoring.worker';
import { startReminderWorker } from './workers/reminder.worker';
import { startExportWorker } from './workers/export.worker';
import { startMcpWebhookWorker } from './workers/mcp-webhook.worker';
import { mcpWebhookQueue } from './config/queues';
import {
  verifyMcpSignature,
  getWebhookSecretForAgent,
  recordDelivery,
} from './services/mcp-webhook.service';

const app = express();

// Security middleware
app.use(helmet());
const corsOrigins = [env.FRONTEND_URL];
// Always allow both www and non-www variants
if (env.FRONTEND_URL.includes('://www.')) {
  corsOrigins.push(env.FRONTEND_URL.replace('://www.', '://'));
} else {
  corsOrigins.push(env.FRONTEND_URL.replace('://', '://www.'));
}

app.use(cors({
  origin: corsOrigins,
  credentials: true,
}));

// Parsing middleware
app.use(compression());
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// WhatsApp webhook — raw body required for HMAC-SHA256 signature verification
// Must be registered BEFORE express.json() so Meta's raw payload is preserved.
app.use('/api/whatsapp/webhook', express.raw({ type: 'application/json' }));

// Stripe webhook — registered BEFORE express.json() so the stream is consumed
// as a raw Buffer by express.raw(). The handler is inline (not via a router)
// to guarantee no other middleware intercepts the body first.
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), async (req, res): Promise<void> => {
  const sig = req.headers['stripe-signature'] as string;
  const secret = process.env['STRIPE_WEBHOOK_SECRET'];

  if (!sig || !secret) {
    res.status(400).json({ error: 'Missing stripe-signature header or STRIPE_WEBHOOK_SECRET' });
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body as Buffer, sig, secret);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[webhook] Signature verification failed:', msg);
    res.status(400).json({ error: msg });
    return;
  }

  console.log('[webhook] Event received:', event.type);

  try {
    await handleWebhookEvent(event);
  } catch (err) {
    console.error(`[webhook] Error handling ${event.type}:`, err);
    // Return 200 — Stripe retries on 5xx, not on 2xx
  }

  res.json({ received: true });
});

// ─── MCP Webhook Endpoint ────────────────────────────────────────────────────
// Inbound side of the Mastershop MCP integration. Receives signed events from
// the MCP when orders change state in Mastershop and notifies the customer
// through the conversation's channel.
//
// Contract: docs/INTEGRATION.md §6 (5 supported events), §7 (CanonicalOrder
// payload shape), §8 (HMAC-SHA256 signing algorithm).
//
// 4-step flow (handler owns 1-3, worker owns 4):
//   1. Validate HMAC — verifyMcpSignature() over the RAW body bytes against
//      the per-agent secret resolved from agent_tools.config (the same secret
//      GenSmart auto-injects as the outbound X-Webhook-Secret header on tool
//      calls — symmetric, see services/mcp-webhook.service.ts).
//   2. Dedup — recordDelivery() does INSERT ON CONFLICT DO NOTHING on the
//      mcp_deliveries table, keyed by X-Delivery-ID. Defense-in-depth on top
//      of the MCP's own upstream dedup (INTEGRATION.md §10.3).
//   3. Enqueue — push the validated payload into mcpWebhookQueue and return
//      200 within ~50ms, well under the MCP's 5s SLO (INTEGRATION.md §9.2).
//   4. Worker processes — see workers/mcp-webhook.worker.ts: looks up the
//      conversation, formats the message, pushes it via WhatsApp/Web channel.
//
// Registered inline BEFORE express.json() so express.raw() preserves the body
// bytes for signature verification. Same pattern as the Stripe webhook above.
const VALID_MCP_EVENTS = new Set([
  'order.created',
  'order.status_changed',
  'order.guide_generated',
  'order.delivered',
  'order.incident',
]);

app.post('/api/webhooks/mcp', express.raw({ type: 'application/json' }), async (req, res): Promise<void> => {
  const t0 = Date.now();
  try {
    const rawBody = req.body as Buffer;
    const signature = req.headers['x-mcp-signature'] as string | undefined;
    const event = req.headers['x-event'] as string | undefined;
    const deliveryId = req.headers['x-delivery-id'] as string | undefined;
    const agentId = req.headers['x-agent-id'] as string | undefined;
    const source = req.headers['x-mcp-source'] as string | undefined;

    if (!signature || !event || !deliveryId || !agentId) {
      res.status(400).json({ error: 'Missing required headers' });
      return;
    }

    if (source && source !== 'mastershop-mcp') {
      // Don't reject — keep room for additional MCP providers in the future,
      // but log so unexpected sources are visible.
      console.warn(`[mcp-webhook] Unknown source: ${source}`);
    }

    if (!VALID_MCP_EVENTS.has(event)) {
      res.status(400).json({ error: `Unknown event: ${event}` });
      return;
    }

    const secret = await getWebhookSecretForAgent(agentId);
    if (!secret) {
      // Mask: don't reveal "no secret configured" — same response as a bad
      // signature so an attacker can't enumerate agents.
      console.warn(`[mcp-webhook] No webhook secret for agent ${agentId}`);
      res.status(401).json({ error: 'invalid_signature' });
      return;
    }

    if (!verifyMcpSignature(rawBody, signature, secret)) {
      console.warn(
        `[mcp-webhook] Invalid signature agent=${agentId} delivery=${deliveryId}`
      );
      res.status(401).json({ error: 'invalid_signature' });
      return;
    }

    // Defense-in-depth dedup. The MCP also dedups upstream by delivery_key
    // (see INTEGRATION.md §10.3) but we record every delivery_id we accept.
    const isNew = await recordDelivery(deliveryId, agentId, event);
    if (!isNew) {
      console.log(
        `[mcp-webhook] Duplicate delivery=${deliveryId} agent=${agentId}, acking`
      );
      res.json({ received: true, status: 'duplicate' });
      return;
    }

    let payload: { event: string; delivered_at: string; data: { order: unknown } };
    try {
      payload = JSON.parse(rawBody.toString('utf-8'));
    } catch (err) {
      console.error('[mcp-webhook] Failed to parse payload:', (err as Error).message);
      res.status(400).json({ error: 'invalid_json' });
      return;
    }

    await mcpWebhookQueue.add('process-mcp-event', {
      agentId,
      event,
      deliveryId,
      payload,
    });

    const t1 = Date.now();
    console.log(
      `[mcp-webhook] ACK ${t1 - t0}ms agent=${agentId} event=${event} delivery=${deliveryId}`
    );

    res.json({ received: true });
  } catch (err) {
    console.error('[mcp-webhook] Unexpected error:', (err as Error).message);
    res.status(500).json({ error: 'internal_error' });
  }
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static files — uploaded avatars and knowledge files
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// Routes
app.use('/api', router);

// 404
app.use((_req, res) => {
  res.status(404).json({ error: { message: 'Not found', code: 'NOT_FOUND' } });
});

// Error handler
app.use(errorHandler);

// Create HTTP server (needed for Socket.IO)
const httpServer = http.createServer(app);

// Initialize WebSocket
initWebSocket(httpServer);

// Start BullMQ workers
startMessageWorker();
startRagWorker();
startScrapingWorker();
startScoringWorker();
startReminderWorker();
startExportWorker();
startMcpWebhookWorker();

// Trial expiration check — runs every hour
import { query as dbQuery } from './config/database';
setInterval(async () => {
  try {
    const result = await dbQuery<{ id: string; name: string }>(
      `UPDATE organizations
       SET plan = 'free', trial_ends_at = NULL, updated_at = NOW()
       WHERE trial_ends_at IS NOT NULL AND trial_ends_at < NOW()
       RETURNING id, name`
    );
    if (result.rows.length > 0) {
      console.log(`[trial-cron] Downgraded ${result.rows.length} expired trials:`,
        result.rows.map(r => r.name).join(', '));
    }
  } catch (err) {
    console.error('[trial-cron] Error checking expired trials:', err);
  }
}, 60 * 60 * 1000);

// Start server
httpServer.listen(env.PORT, () => {
  console.log(`GenSmart API running on port ${env.PORT}`);
  console.log(`WebSocket server ready`);
  console.log(`Workers started: message, rag, scraping, scoring, reminder, export, mcp-webhook`);
});

export default app;
