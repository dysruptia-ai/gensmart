"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyMcpSignature = verifyMcpSignature;
exports.getWebhookSecretForAgent = getWebhookSecretForAgent;
exports.recordDelivery = recordDelivery;
const crypto_1 = require("crypto");
const database_1 = require("../config/database");
const encryption_1 = require("../config/encryption");
/**
 * Validate the X-MCP-Signature header against the raw body using HMAC-SHA256.
 * Header format: "sha256=<hex>" (see INTEGRATION.md §8).
 */
function verifyMcpSignature(rawBody, signatureHeader, webhookSecret) {
    if (!signatureHeader || !signatureHeader.startsWith('sha256='))
        return false;
    const provided = signatureHeader.slice(7);
    const expected = (0, crypto_1.createHmac)('sha256', webhookSecret).update(rawBody).digest('hex');
    // Constant-time comparison. Bail early on length mismatch to avoid Buffer.from
    // throwing on odd-length hex.
    if (provided.length !== expected.length)
        return false;
    let providedBuf;
    let expectedBuf;
    try {
        providedBuf = Buffer.from(provided, 'hex');
        expectedBuf = Buffer.from(expected, 'hex');
    }
    catch {
        return false;
    }
    if (providedBuf.length !== expectedBuf.length)
        return false;
    return (0, crypto_1.timingSafeEqual)(providedBuf, expectedBuf);
}
/**
 * Resolve the webhook secret for an agent.
 *
 * Strategy: pick the first MCP tool of the agent that has a configured
 * webhookSecret_encrypted. In practice an agent should have at most one MCP
 * provider (= one secret), and a multi-MCP setup would need namespacing the
 * secret per-tool — out of scope for the MVP.
 */
async function getWebhookSecretForAgent(agentId) {
    const result = await (0, database_1.query)(`SELECT config FROM agent_tools
     WHERE agent_id = $1 AND type = 'mcp' AND is_enabled = true
     ORDER BY created_at ASC`, [agentId]);
    for (const row of result.rows) {
        const cfg = row.config;
        if (cfg?.webhookSecret_encrypted) {
            try {
                return (0, encryption_1.decrypt)(cfg.webhookSecret_encrypted);
            }
            catch (err) {
                console.error(`[mcp-webhook] Failed to decrypt webhookSecret for agent ${agentId}:`, err.message);
            }
        }
    }
    return null;
}
/**
 * Insert a delivery_id into mcp_deliveries.
 * Returns true if the row was newly inserted (caller should process the event),
 * false if the delivery_id already existed (duplicate — ack and skip).
 */
async function recordDelivery(deliveryId, agentId, event) {
    const result = await (0, database_1.query)(`INSERT INTO mcp_deliveries (delivery_id, agent_id, event)
     VALUES ($1, $2, $3)
     ON CONFLICT (delivery_id) DO NOTHING
     RETURNING delivery_id`, [deliveryId, agentId, event]);
    return result.rows.length > 0;
}
//# sourceMappingURL=mcp-webhook.service.js.map