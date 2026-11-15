/**
 * Signature policy of the WhatsApp webhook (routes/whatsapp.ts). Pure: no imports.
 *
 * - App secret configured → the X-Hub-Signature-256 HMAC is always verified.
 * - No app secret → rejected, unless WHATSAPP_ALLOW_UNSIGNED_WEBHOOKS=true AND NODE_ENV is not
 *   'production' (local testing only). The flag is never honoured in production.
 *
 * channel_metadata.wa_from (the buyer identity of the Dropi sales tools, among others) comes from
 * this body, so an unsigned body must never be accepted on a reachable server by accident.
 */
export type WebhookSignaturePolicy = 'verify' | 'allow_unsigned' | 'reject';

export function whatsappWebhookSignaturePolicy(input: {
  appSecret: string;
  nodeEnv: string;
  allowUnsigned: boolean;
}): WebhookSignaturePolicy {
  if (input.appSecret) return 'verify';
  if (input.allowUnsigned && input.nodeEnv !== 'production') return 'allow_unsigned';
  return 'reject';
}
