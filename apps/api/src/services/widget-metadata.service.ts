/**
 * Metadata filter for the public widget endpoints. messages.metadata also carries internal data
 * (tool calls with their arguments, token usage, model, error details, dashboard user ids) that
 * only the dashboard needs.
 *
 * Exclusion list (not allow list): only known sensitive keys (toolsCalled, tokensUsed, model,
 * latencyMs, error, errorMessage) and actor keys are removed. Unknown or harmless keys pass through
 * because clients outside this repository (the Tiendanube/NubeSDK widget) consume keys such as
 * cart_action and cart_query from the long-poll and we cannot enumerate everything they read.
 * images, hasImages, imageCount and isVoiceMessage (human messages) pass on purpose: they are
 * content the dashboard user sends to the customer.
 */

const INTERNAL_KEYS = new Set([
  'toolsCalled',
  'tokensUsed',
  'model',
  'latencyMs',
  'error',
  'errorMessage',
]);

/** Keys that identify the dashboard user (or any internal actor) who wrote a message. */
const INTERNAL_ACTOR_KEY = /user_?id|sent_?by|sender|author|staff|operator|agent_?id|created_?by|human_?id/i;

const HANDOFF_URL_PREFIX = 'https://wa.me/';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function sanitizeWidgetMessageMetadata(
  metadata: Record<string, unknown> | null
): Record<string, unknown> | null {
  if (!isPlainObject(metadata)) return null;

  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (INTERNAL_KEYS.has(key) || INTERNAL_ACTOR_KEY.test(key)) continue;
    if (key === 'handoff') {
      if (
        isPlainObject(value) &&
        typeof value['url'] === 'string' &&
        value['url'].startsWith(HANDOFF_URL_PREFIX) &&
        typeof value['buttonText'] === 'string'
      ) {
        clean['handoff'] = { url: value['url'], buttonText: value['buttonText'] };
      }
      continue;
    }
    clean[key] = value;
  }
  return clean;
}
