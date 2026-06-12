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
export declare const MCP_HEADER_PRESERVE_PLACEHOLDER = "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022";
/**
 * Encrypt an array of plain headers for storage.
 * Skips entries with empty keys.
 */
export declare function encryptHeaders(headers: PlainHeader[]): EncryptedHeader[];
/**
 * Decrypt headers stored in agent_tools.config.headers.
 * Returns a flat object suitable for HTTP request headers.
 * If a header fails to decrypt, it is logged and skipped.
 */
export declare function decryptHeaders(headers: EncryptedHeader[] | undefined): Record<string, string>;
/**
 * Generate a cryptographically secure webhook secret (32 bytes hex = 64 chars).
 * Used both as outbound `X-Webhook-Secret` header AND as inbound HMAC key.
 */
export declare function generateWebhookSecret(): string;
//# sourceMappingURL=mcp-headers.service.d.ts.map