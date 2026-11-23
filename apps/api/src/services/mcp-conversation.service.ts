/**
 * Resolves which conversation an inbound MCP order event belongs to.
 *
 * Only an EXACT match is accepted: captured_variables->>'externalOrderId' of a
 * conversation of the same agent. There is deliberately NO fallback to "the most
 * recent conversation of the agent": that heuristic (removed after an incident
 * where a notice about a Vista previa order reached an unrelated customer) can
 * deliver one customer's order status to another customer.
 *
 * Trade-off: events for orders whose externalOrderId was never captured in a
 * conversation (preview/test orders, orders created outside GenSmart, a webhook
 * that arrives before the model captures the variable) are NOT notified.
 *
 * Definitive solution: have the MCP return a conversation identifier in the
 * webhook payload (echoing the one GenSmart sends at create_order time).
 */
import { query } from '../config/database';

export interface ConversationRow {
  id: string;
  channel: string;
  channel_metadata: Record<string, unknown>;
  organization_id: string;
}

export type QueryFn = <T>(text: string, params: unknown[]) => Promise<{ rows: T[] }>;

export async function findConversationForOrder(
  agentId: string,
  externalOrderId: string | null,
  run: QueryFn = query as unknown as QueryFn
): Promise<ConversationRow | null> {
  if (!externalOrderId) return null;
  const byVar = await run<ConversationRow>(
    `SELECT id, channel, channel_metadata, organization_id
     FROM conversations
     WHERE agent_id = $1
       AND captured_variables->>'externalOrderId' = $2
     ORDER BY updated_at DESC
     LIMIT 1`,
    [agentId, externalOrderId]
  );
  return byVar.rows[0] ?? null;
}

/** Log line for a delivery that has no exact conversation. No buyer data. */
export function formatNoConversationLog(
  agentId: string,
  event: string,
  pin: number | string,
  deliveryId: string
): string {
  return `[mcp-webhook] no-conversation agent=${agentId.slice(0, 8)} event=${event} pin=${pin} delivery=${deliveryId.slice(0, 8)}`;
}
