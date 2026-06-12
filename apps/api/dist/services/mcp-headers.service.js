"use strict";
/**
 * MCP Headers Service
 *
 * Helpers for encrypting/decrypting per-tool MCP request headers and
 * generating webhook secrets used for symmetric HMAC signing of inbound
 * webhooks (see docs/INTEGRATION.md §3, §8).
 *
 * Storage shape in `agent_tools.config.headers`:
 *   Array<{ key: string, value_encrypted: string }>
 *
 * The webhook secret lives in `agent_tools.config.webhookSecret_encrypted`
 * (separate from headers — auto-generated, never user-editable).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCP_HEADER_PRESERVE_PLACEHOLDER = void 0;
exports.encryptHeaders = encryptHeaders;
exports.decryptHeaders = decryptHeaders;
exports.generateWebhookSecret = generateWebhookSecret;
const crypto_1 = require("crypto");
const encryption_1 = require("../config/encryption");
/**
 * Sentinel returned by the API to the frontend in place of decrypted header
 * values (which are never sent out). On UPDATE, the frontend echoes this
 * string back for headers the user did not retype; the route treats it as
 * "preserve existing ciphertext". A literal empty string ('') on UPDATE is
 * an explicit "delete this header". Must match
 * `MCP_HEADER_PRESERVE_PLACEHOLDER` in `apps/web/components/agents/MCPConfigurator`.
 */
exports.MCP_HEADER_PRESERVE_PLACEHOLDER = '••••••••';
/**
 * Encrypt an array of plain headers for storage.
 * Skips entries with empty keys.
 */
function encryptHeaders(headers) {
    return headers
        .filter((h) => h.key.trim().length > 0)
        .map((h) => ({
        key: h.key.trim(),
        value_encrypted: (0, encryption_1.encrypt)(h.value),
    }));
}
/**
 * Decrypt headers stored in agent_tools.config.headers.
 * Returns a flat object suitable for HTTP request headers.
 * If a header fails to decrypt, it is logged and skipped.
 */
function decryptHeaders(headers) {
    if (!Array.isArray(headers))
        return {};
    const result = {};
    for (const h of headers) {
        if (!h?.key || !h?.value_encrypted)
            continue;
        try {
            result[h.key] = (0, encryption_1.decrypt)(h.value_encrypted);
        }
        catch (err) {
            console.error(`[mcp-headers] Failed to decrypt header "${h.key}":`, err.message);
        }
    }
    return result;
}
/**
 * Generate a cryptographically secure webhook secret (32 bytes hex = 64 chars).
 * Used both as outbound `X-Webhook-Secret` header AND as inbound HMAC key.
 */
function generateWebhookSecret() {
    return (0, crypto_1.randomBytes)(32).toString('hex');
}
//# sourceMappingURL=mcp-headers.service.js.map