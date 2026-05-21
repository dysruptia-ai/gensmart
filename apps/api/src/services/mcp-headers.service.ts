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

import { randomBytes } from 'crypto';
import { encrypt, decrypt } from '../config/encryption';

export interface EncryptedHeader {
  key: string;
  value_encrypted: string;
}

export interface PlainHeader {
  key: string;
  value: string;
}

/**
 * Sentinel returned by the API to the frontend in place of decrypted header
 * values (which are never sent out). On UPDATE, the frontend echoes this
 * string back for headers the user did not retype; the route treats it as
 * "preserve existing ciphertext". A literal empty string ('') on UPDATE is
 * an explicit "delete this header". Must match
 * `MCP_HEADER_PRESERVE_PLACEHOLDER` in `apps/web/components/agents/MCPConfigurator`.
 */
export const MCP_HEADER_PRESERVE_PLACEHOLDER = '••••••••';

/**
 * Encrypt an array of plain headers for storage.
 * Skips entries with empty keys.
 */
export function encryptHeaders(headers: PlainHeader[]): EncryptedHeader[] {
  return headers
    .filter((h) => h.key.trim().length > 0)
    .map((h) => ({
      key: h.key.trim(),
      value_encrypted: encrypt(h.value),
    }));
}

/**
 * Decrypt headers stored in agent_tools.config.headers.
 * Returns a flat object suitable for HTTP request headers.
 * If a header fails to decrypt, it is logged and skipped.
 */
export function decryptHeaders(headers: EncryptedHeader[] | undefined): Record<string, string> {
  if (!Array.isArray(headers)) return {};
  const result: Record<string, string> = {};
  for (const h of headers) {
    if (!h?.key || !h?.value_encrypted) continue;
    try {
      result[h.key] = decrypt(h.value_encrypted);
    } catch (err) {
      console.error(`[mcp-headers] Failed to decrypt header "${h.key}":`, (err as Error).message);
    }
  }
  return result;
}

/**
 * Generate a cryptographically secure webhook secret (32 bytes hex = 64 chars).
 * Used both as outbound `X-Webhook-Secret` header AND as inbound HMAC key.
 */
export function generateWebhookSecret(): string {
  return randomBytes(32).toString('hex');
}
