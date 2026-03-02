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

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true,
}));

// Parsing middleware
app.use(compression());
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

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

// Start server
httpServer.listen(env.PORT, () => {
  console.log(`GenSmart API running on port ${env.PORT}`);
  console.log(`WebSocket server ready`);
  console.log(`Workers started: message, rag, scraping, scoring, reminder`);
});

export default app;
