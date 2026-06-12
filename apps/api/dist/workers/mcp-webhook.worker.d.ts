/**
 * MCP Webhook Worker
 *
 * Step 4 of the inbound MCP flow. The HTTP endpoint at POST
 * /api/webhooks/mcp owns steps 1-3 (validate HMAC → dedup by delivery_id
 * → enqueue) and acks within ~50ms; this worker drains the queue and
 * delivers the notification to the customer.
 *
 * Inbound flow — full picture across the integration:
 *
 *   1. Validate HMAC — endpoint runs `verifyMcpSignature` against the raw
 *      body. See mcp-webhook.service.ts and docs/INTEGRATION.md §8.
 *   2. Dedup — endpoint runs `recordDelivery` (INSERT ON CONFLICT DO
 *      NOTHING) on the mcp_deliveries table. See INTEGRATION.md §10.3.
 *   3. Enqueue — endpoint pushes the parsed payload into BullMQ and
 *      responds 200 inside the MCP's 5s SLO (INTEGRATION.md §9.2).
 *   4. Worker processes (this module):
 *        a. `findConversationForOrder` resolves the originating
 *           conversation (captured_variables.externalOrderId → most
 *           recent active conversation in the last 24h as fallback).
 *        b. `formatNotification` produces a customer-facing Spanish
 *           message per event type (docs/INTEGRATION.md §6).
 *        c. `notifyClient` persists the message in the `messages` table
 *           (so it shows up in the dashboard regardless of channel
 *           delivery), then pushes via WhatsApp Cloud API or the web
 *           widget WebSocket room.
 *
 * Payload shape: GenSmartEventPayload (docs/INTEGRATION.md §7) — the
 * order CanonicalOrder subset is typed locally below.
 *
 * Retry policy: 3 attempts with exponential backoff 2s/4s/8s (configured
 * in apps/api/src/config/queues.ts on `mcpWebhookQueue`). The HTTP ACK
 * has already been sent — retries are GenSmart-internal and don't trigger
 * the MCP to re-deliver.
 */
import { Worker } from 'bullmq';
type McpEvent = 'order.created' | 'order.status_changed' | 'order.guide_generated' | 'order.delivered' | 'order.incident';
interface McpWebhookJobData {
    agentId: string;
    event: McpEvent;
    deliveryId: string;
    payload: {
        event: string;
        delivered_at: string;
        data: {
            order: CanonicalOrder;
        };
    };
}
/**
 * Subset of CanonicalOrder we actually use for notifications.
 * Full schema in docs/INTEGRATION.md §7.
 */
interface CanonicalOrder {
    idOrder: number;
    externalOrderId: string | null;
    status: {
        id: number;
        name: string;
        confirmationStatus: string | null;
        cancellationReason: string | null;
    };
    logistics: {
        carrierName: string | null;
        tracking: {
            guide: string | null;
            trackingUrl: string | null;
        };
    };
    items: Array<{
        name: string;
        variantName: string | null;
        quantity: number;
    }>;
    alerts: Array<{
        name: string;
    }>;
    total: number;
}
export declare function startMcpWebhookWorker(): Worker<McpWebhookJobData>;
export {};
//# sourceMappingURL=mcp-webhook.worker.d.ts.map