/**
 * channel_metadata keys that only the server writes. Pure: no imports.
 * - wa_from: WhatsApp sender identity (routes/whatsapp.ts, from Meta's signed webhook).
 * - ip_hash: web widget network (routes/widget.ts, HMAC of the client IP; never the IP itself).
 * Any client-supplied channel_metadata (POST /api/conversations) is stripped of them.
 */
export const RESERVED_CHANNEL_KEYS: ReadonlySet<string> = new Set(['wa_from', 'ip_hash']);

export function withoutReservedChannelKeys(meta: unknown): Record<string, unknown> {
  if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) return {};
  return Object.fromEntries(
    Object.entries(meta as Record<string, unknown>).filter(([k]) => !RESERVED_CHANNEL_KEYS.has(k))
  );
}
