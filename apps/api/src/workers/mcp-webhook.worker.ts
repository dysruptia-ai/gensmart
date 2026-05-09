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

import { Worker, Job } from 'bullmq';
import { createBullConnection } from '../config/queues';
import { query } from '../config/database';
import { sendTextMessage, resolveAccessToken } from '../services/whatsapp.service';
import { getIO } from '../config/websocket';

type McpEvent =
  | 'order.created'
  | 'order.status_changed'
  | 'order.guide_generated'
  | 'order.delivered'
  | 'order.incident';

interface McpWebhookJobData {
  agentId: string;
  event: McpEvent;
  deliveryId: string;
  payload: {
    event: string;
    delivered_at: string;
    data: { order: CanonicalOrder };
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
  alerts: Array<{ name: string }>;
  total: number;
}

interface ConversationRow {
  id: string;
  channel: string;
  channel_metadata: Record<string, unknown>;
  organization_id: string;
}

function formatCurrencyCOP(n: number): string {
  return `$${n.toLocaleString('es-CO', { maximumFractionDigits: 0 })} COP`;
}

/**
 * Format an event into a customer-facing message in Spanish.
 * Adjust copy as the product team iterates.
 */
function formatNotification(event: McpEvent, order: CanonicalOrder): string {
  switch (event) {
    case 'order.created': {
      const itemsList = order.items
        .slice(0, 3)
        .map(
          (i) =>
            `• ${i.name}${i.variantName ? ` (${i.variantName})` : ''} x${i.quantity}`
        )
        .join('\n');
      const more = order.items.length > 3 ? `\n  + ${order.items.length - 3} más` : '';
      return [
        '✅ ¡Tu pedido fue creado!',
        '',
        '📦 Detalles:',
        itemsList + more,
        '',
        `💵 Total: ${formatCurrencyCOP(order.total)}`,
        '🚚 Pago contraentrega',
        '',
        `ID del pedido: ${order.idOrder}`,
        '',
        'Te avisaremos cuando se genere la guía de envío.',
      ].join('\n');
    }
    case 'order.status_changed': {
      // id 9 = Cancelada per Mastershop catalogs
      if (order.status.id === 9) {
        const reason = order.status.cancellationReason
          ? `\nMotivo: ${order.status.cancellationReason}`
          : '';
        return `⚠️ Tu pedido #${order.idOrder} fue cancelado.${reason}`;
      }
      return `📋 Estado actualizado de tu pedido #${order.idOrder}: *${order.status.name}*`;
    }
    case 'order.guide_generated': {
      const tracking = order.logistics.tracking.trackingUrl
        ? `\n🔍 Rastrear: ${order.logistics.tracking.trackingUrl}`
        : '';
      return [
        `🚚 ¡Tu pedido #${order.idOrder} ya tiene guía!`,
        '',
        `Transportadora: ${order.logistics.carrierName ?? 'Asignada'}`,
        `Guía: ${order.logistics.tracking.guide ?? 'Por generar'}${tracking}`,
      ].join('\n');
    }
    case 'order.delivered':
      return `📦 ¡Tu pedido #${order.idOrder} fue entregado! Gracias por tu compra.`;
    case 'order.incident': {
      const alertNames = order.alerts.map((a) => a.name).join(', ');
      return `⚠️ Tu pedido #${order.idOrder} tiene una novedad: ${alertNames || 'Revisar con el dropshipper'}.`;
    }
    default:
      return `Actualización de tu pedido #${(order as CanonicalOrder).idOrder}.`;
  }
}

/**
 * Find the conversation that originated this order.
 *
 * Strategy:
 *   1. Match externalOrderId against captured_variables.externalOrderId.
 *   2. Fallback: most recent `active` conversation for this agent in the last
 *      24h. Best-effort — if the agent had multiple parallel conversations,
 *      the wrong one may receive the notification.
 *
 * TODO post-MVP: introduce a dedicated `mcp_orders` table linking
 * (agent_id, externalOrderId) → conversation_id at create_order time so we
 * never rely on heuristics.
 */
async function findConversationForOrder(
  agentId: string,
  externalOrderId: string | null,
): Promise<ConversationRow | null> {
  if (externalOrderId) {
    const byVar = await query<ConversationRow>(
      `SELECT id, channel, channel_metadata, organization_id
       FROM conversations
       WHERE agent_id = $1
         AND captured_variables->>'externalOrderId' = $2
       ORDER BY updated_at DESC
       LIMIT 1`,
      [agentId, externalOrderId]
    );
    if (byVar.rows.length > 0) return byVar.rows[0]!;
  }

  const fallback = await query<ConversationRow>(
    `SELECT id, channel, channel_metadata, organization_id
     FROM conversations
     WHERE agent_id = $1
       AND status = 'active'
       AND updated_at > NOW() - INTERVAL '24 hours'
     ORDER BY updated_at DESC
     LIMIT 1`,
    [agentId]
  );
  return fallback.rows[0] ?? null;
}

/**
 * Persist the notification as an assistant message and deliver it on the
 * conversation's channel.
 */
async function notifyClient(
  agentId: string,
  conversation: ConversationRow,
  message: string,
): Promise<void> {
  // Persist first, so the message shows up in the dashboard even if delivery
  // to the external channel fails.
  await query(
    `INSERT INTO messages (conversation_id, role, content, metadata)
     VALUES ($1, 'assistant', $2, $3)`,
    [conversation.id, message, JSON.stringify({ source: 'mcp-webhook' })]
  );
  await query(
    `UPDATE conversations
     SET last_message_at = NOW(), message_count = message_count + 1, updated_at = NOW()
     WHERE id = $1`,
    [conversation.id]
  );

  if (conversation.channel === 'whatsapp') {
    const agentResult = await query<{ whatsapp_config: Record<string, unknown> | null }>(
      'SELECT whatsapp_config FROM agents WHERE id = $1',
      [agentId]
    );
    if (agentResult.rows.length === 0) {
      throw new Error(`Agent ${agentId} not found for WhatsApp notification`);
    }
    const waConfig = agentResult.rows[0].whatsapp_config ?? {};
    const phoneNumberId = (waConfig['phone_number_id'] ?? waConfig['phoneNumberId']) as string | undefined;
    const accessToken = await resolveAccessToken(waConfig);
    const meta = conversation.channel_metadata ?? {};
    const recipientPhone = (meta['from'] ?? meta['phone']) as string | undefined;

    if (!phoneNumberId || !accessToken || !recipientPhone) {
      throw new Error(
        `Missing WhatsApp config for agent ${agentId}: phoneNumberId=${!!phoneNumberId}, token=${!!accessToken}, recipient=${!!recipientPhone}`
      );
    }

    await sendTextMessage(phoneNumberId, accessToken, recipientPhone, message);
  } else if (conversation.channel === 'web') {
    // Web widget: long-poll picks up DB messages, but emit too so dashboards
    // and any open widget tabs get instant updates.
    try {
      getIO().to(`conv:${conversation.id}`).emit('message:new', {
        conversationId: conversation.id,
        role: 'assistant',
        content: message,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error(
        '[mcp-webhook-worker] Failed to emit websocket message:',
        (err as Error).message
      );
    }
  } else {
    console.warn(
      `[mcp-webhook-worker] Unsupported channel for MCP notification: ${conversation.channel} (conv ${conversation.id})`
    );
  }
}

export function startMcpWebhookWorker(): Worker<McpWebhookJobData> {
  const worker = new Worker<McpWebhookJobData>(
    'mcp-webhook-processing',
    async (job: Job<McpWebhookJobData>) => {
      const { agentId, event, deliveryId, payload } = job.data;
      const order = payload.data.order;

      console.log(
        `[mcp-webhook-worker] Processing ${event} agent=${agentId} order=${order.idOrder} delivery=${deliveryId}`
      );

      const conversation = await findConversationForOrder(agentId, order.externalOrderId);
      if (!conversation) {
        // Successful job (delivery already ACKed); nothing to notify because
        // we can't link the order to a conversation. Log so it shows up in
        // metrics if this becomes common.
        console.warn(
          `[mcp-webhook-worker] No conversation found for order ${order.idOrder} (agent ${agentId})`
        );
        return;
      }

      const message = formatNotification(event, order);
      await notifyClient(agentId, conversation, message);

      console.log(
        `[mcp-webhook-worker] Notified conv ${conversation.id} via ${conversation.channel} (delivery ${deliveryId})`
      );
    },
    {
      connection: createBullConnection(),
      concurrency: 5,
    }
  );

  worker.on('failed', (job, err) => {
    console.error(
      `[mcp-webhook-worker] Job ${job?.id} failed (delivery ${job?.data?.deliveryId}):`,
      err.message
    );
  });

  worker.on('completed', (job) => {
    console.log(
      `[mcp-webhook-worker] Job ${job.id} completed (delivery ${job.data.deliveryId})`
    );
  });

  console.log('[mcp-webhook-worker] Started');
  return worker;
}
