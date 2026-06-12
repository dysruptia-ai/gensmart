"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const http_1 = __importDefault(require("http"));
dotenv_1.default.config({ path: path_1.default.resolve(process.cwd(), '../../.env') });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const morgan_1 = __importDefault(require("morgan"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const stripe_1 = require("./config/stripe");
const env_1 = require("./config/env");
const index_1 = __importDefault(require("./routes/index"));
const stripe_service_1 = require("./services/stripe.service");
const errorHandler_1 = require("./middleware/errorHandler");
const websocket_1 = require("./config/websocket");
const message_worker_1 = require("./workers/message.worker");
const rag_worker_1 = require("./workers/rag.worker");
const scraping_worker_1 = require("./workers/scraping.worker");
const scoring_worker_1 = require("./workers/scoring.worker");
const reminder_worker_1 = require("./workers/reminder.worker");
const export_worker_1 = require("./workers/export.worker");
const mcp_webhook_worker_1 = require("./workers/mcp-webhook.worker");
const queues_1 = require("./config/queues");
const mcp_webhook_service_1 = require("./services/mcp-webhook.service");
const app = (0, express_1.default)();
// Security middleware
app.use((0, helmet_1.default)());
const corsOrigins = [env_1.env.FRONTEND_URL];
// Always allow both www and non-www variants
if (env_1.env.FRONTEND_URL.includes('://www.')) {
    corsOrigins.push(env_1.env.FRONTEND_URL.replace('://www.', '://'));
}
else {
    corsOrigins.push(env_1.env.FRONTEND_URL.replace('://', '://www.'));
}
app.use((0, cors_1.default)({
    origin: corsOrigins,
    credentials: true,
}));
// Parsing middleware
app.use((0, compression_1.default)());
app.use((0, morgan_1.default)(env_1.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
// WhatsApp webhook — raw body required for HMAC-SHA256 signature verification
// Must be registered BEFORE express.json() so Meta's raw payload is preserved.
app.use('/api/whatsapp/webhook', express_1.default.raw({ type: 'application/json' }));
// Stripe webhook — registered BEFORE express.json() so the stream is consumed
// as a raw Buffer by express.raw(). The handler is inline (not via a router)
// to guarantee no other middleware intercepts the body first.
app.post('/api/billing/webhook', express_1.default.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const secret = process.env['STRIPE_WEBHOOK_SECRET'];
    if (!sig || !secret) {
        res.status(400).json({ error: 'Missing stripe-signature header or STRIPE_WEBHOOK_SECRET' });
        return;
    }
    let event;
    try {
        event = stripe_1.stripe.webhooks.constructEvent(req.body, sig, secret);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[webhook] Signature verification failed:', msg);
        res.status(400).json({ error: msg });
        return;
    }
    console.log('[webhook] Event received:', event.type);
    try {
        await (0, stripe_service_1.handleWebhookEvent)(event);
    }
    catch (err) {
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
app.post('/api/webhooks/mcp', express_1.default.raw({ type: 'application/json' }), async (req, res) => {
    const t0 = Date.now();
    try {
        const rawBody = req.body;
        const signature = req.headers['x-mcp-signature'];
        const event = req.headers['x-event'];
        const deliveryId = req.headers['x-delivery-id'];
        const agentId = req.headers['x-agent-id'];
        const source = req.headers['x-mcp-source'];
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
        const secret = await (0, mcp_webhook_service_1.getWebhookSecretForAgent)(agentId);
        if (!secret) {
            // Mask: don't reveal "no secret configured" — same response as a bad
            // signature so an attacker can't enumerate agents.
            console.warn(`[mcp-webhook] No webhook secret for agent ${agentId}`);
            res.status(401).json({ error: 'invalid_signature' });
            return;
        }
        if (!(0, mcp_webhook_service_1.verifyMcpSignature)(rawBody, signature, secret)) {
            console.warn(`[mcp-webhook] Invalid signature agent=${agentId} delivery=${deliveryId}`);
            res.status(401).json({ error: 'invalid_signature' });
            return;
        }
        // Defense-in-depth dedup. The MCP also dedups upstream by delivery_key
        // (see INTEGRATION.md §10.3) but we record every delivery_id we accept.
        const isNew = await (0, mcp_webhook_service_1.recordDelivery)(deliveryId, agentId, event);
        if (!isNew) {
            console.log(`[mcp-webhook] Duplicate delivery=${deliveryId} agent=${agentId}, acking`);
            res.json({ received: true, status: 'duplicate' });
            return;
        }
        let payload;
        try {
            payload = JSON.parse(rawBody.toString('utf-8'));
        }
        catch (err) {
            console.error('[mcp-webhook] Failed to parse payload:', err.message);
            res.status(400).json({ error: 'invalid_json' });
            return;
        }
        await queues_1.mcpWebhookQueue.add('process-mcp-event', {
            agentId,
            event,
            deliveryId,
            payload,
        });
        const t1 = Date.now();
        console.log(`[mcp-webhook] ACK ${t1 - t0}ms agent=${agentId} event=${event} delivery=${deliveryId}`);
        res.json({ received: true });
    }
    catch (err) {
        console.error('[mcp-webhook] Unexpected error:', err.message);
        res.status(500).json({ error: 'internal_error' });
    }
});
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, cookie_parser_1.default)());
// Static files — uploaded avatars and knowledge files
const uploadsDir = path_1.default.join(process.cwd(), 'uploads');
if (!fs_1.default.existsSync(uploadsDir))
    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express_1.default.static(uploadsDir));
// Routes
app.use('/api', index_1.default);
// 404
app.use((_req, res) => {
    res.status(404).json({ error: { message: 'Not found', code: 'NOT_FOUND' } });
});
// Error handler
app.use(errorHandler_1.errorHandler);
// Create HTTP server (needed for Socket.IO)
const httpServer = http_1.default.createServer(app);
// Initialize WebSocket
(0, websocket_1.initWebSocket)(httpServer);
// Start BullMQ workers
(0, message_worker_1.startMessageWorker)();
(0, rag_worker_1.startRagWorker)();
(0, scraping_worker_1.startScrapingWorker)();
(0, scoring_worker_1.startScoringWorker)();
(0, reminder_worker_1.startReminderWorker)();
(0, export_worker_1.startExportWorker)();
(0, mcp_webhook_worker_1.startMcpWebhookWorker)();
// Trial expiration check — runs every hour
const database_1 = require("./config/database");
setInterval(async () => {
    try {
        const result = await (0, database_1.query)(`UPDATE organizations
       SET plan = 'free', trial_ends_at = NULL, updated_at = NOW()
       WHERE trial_ends_at IS NOT NULL AND trial_ends_at < NOW()
       RETURNING id, name`);
        if (result.rows.length > 0) {
            console.log(`[trial-cron] Downgraded ${result.rows.length} expired trials:`, result.rows.map(r => r.name).join(', '));
        }
    }
    catch (err) {
        console.error('[trial-cron] Error checking expired trials:', err);
    }
}, 60 * 60 * 1000);
// Start server
httpServer.listen(env_1.env.PORT, () => {
    console.log(`GenSmart API running on port ${env_1.env.PORT}`);
    console.log(`WebSocket server ready`);
    console.log(`Workers started: message, rag, scraping, scoring, reminder, export, mcp-webhook`);
});
exports.default = app;
//# sourceMappingURL=index.js.map