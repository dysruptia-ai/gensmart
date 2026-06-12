/**
 * MCP Webhook Service
 *
 * Helpers for the inbound side of the MCP integration. Owns the security
 * primitives (HMAC verification, secret resolution) and the durable dedup
 * (mcp_deliveries table).
 *
 * Inbound flow — covers both this module and mcp-webhook.worker.ts:
 *
 *   1. Validate HMAC — `verifyMcpSignature` constant-time-compares
 *      `X-MCP-Signature` against `HMAC_SHA256(rawBody, secret)`. The secret
 *      is resolved by `getWebhookSecretForAgent` (decrypts
 *      `agent_tools.config.webhookSecret_encrypted` for the agent's MCP
 *      tool — the same value GenSmart auto-injects as the outbound
 *      `X-Webhook-Secret` header on tool calls).
 *
 *   2. Dedup — `recordDelivery` does an `INSERT ... ON CONFLICT
 *      (delivery_id) DO NOTHING RETURNING delivery_id`. Returns true on a
 *      new row (process the event), false on a duplicate (ack and skip).
 *      Defense-in-depth: the MCP also dedups upstream (INTEGRATION.md
 *      §10.3), but a delivery may still arrive twice on retry boundaries.
 *
 *   3. Enqueue — the endpoint handler in apps/api/src/index.ts pushes the
 *      validated payload into the `mcp-webhook-processing` BullMQ queue and
 *      returns 200 within ~50ms. Keeps us well under the MCP's 5s timeout
 *      (INTEGRATION.md §9.2) so we never waste an upstream retry.
 *
 *   4. Worker processes — see mcp-webhook.worker.ts. Looks up the
 *      conversation, formats the customer-facing notification, and pushes
 *      via the conversation's channel.
 *
 * Contract reference: see docs/INTEGRATION.md §6 (events), §7 (payload),
 * §8 (HMAC algorithm).
 *
 * The signature MUST be verified against the raw request body bytes —
 * Express registers `express.raw({ type: 'application/json' })` for this
 * route in apps/api/src/index.ts before `express.json()` to preserve the
 * bytes.
 */
/**
 * Validate the X-MCP-Signature header against the raw body using HMAC-SHA256.
 * Header format: "sha256=<hex>" (see INTEGRATION.md §8).
 */
export declare function verifyMcpSignature(rawBody: Buffer, signatureHeader: string | undefined, webhookSecret: string): boolean;
/**
 * Resolve the webhook secret for an agent.
 *
 * Strategy: pick the first MCP tool of the agent that has a configured
 * webhookSecret_encrypted. In practice an agent should have at most one MCP
 * provider (= one secret), and a multi-MCP setup would need namespacing the
 * secret per-tool — out of scope for the MVP.
 */
export declare function getWebhookSecretForAgent(agentId: string): Promise<string | null>;
/**
 * Insert a delivery_id into mcp_deliveries.
 * Returns true if the row was newly inserted (caller should process the event),
 * false if the delivery_id already existed (duplicate — ack and skip).
 */
export declare function recordDelivery(deliveryId: string, agentId: string, event: string): Promise<boolean>;
//# sourceMappingURL=mcp-webhook.service.d.ts.map