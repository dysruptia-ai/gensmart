import { chat, type ChatMessage } from './llm.service';

/**
 * Detects whether text mentions a shipping cost figure. Used to catch cases
 * where check_shipping_zones returned zones: [] (no fixed/flat_rate — e.g. a
 * dynamic carrier-calculated rate) but the LLM invented a number ("$0",
 * "gratis", "sin costo"...) anyway. Prompt-only guards against this failed in
 * production testing (Maxi / MakroPet Mascotas: ~1 in 4 attempts even at
 * temperature 0.1), so this is a deterministic code-level backstop.
 */
export function mentionsShippingCost(text: string): boolean {
  const shippingKeywords = /(envío|domicilio|shipping|delivery)/gi;
  const currencyPattern = /\$\s?\d[\d.,]*|\bgratis\b|\bsin costo\b|\bsin cargo\b|\bsin cobro\b/i;

  // Only flag currency/"free" language that appears near a shipping-related
  // word — avoids false positives on unrelated product prices.
  const windows: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = shippingKeywords.exec(text)) !== null) {
    const start = Math.max(0, match.index - 60);
    const end = Math.min(text.length, match.index + 60);
    windows.push(text.slice(start, end));
  }

  return windows.some((w) => currencyPattern.test(w));
}

/**
 * Makes a single corrective LLM call to rewrite a response that invented a
 * shipping cost, replacing it with the standard "calculated at checkout"
 * line. Only called when mentionsShippingCost(finalResponse) is true for a
 * turn where check_shipping_zones returned zones: [].
 */
export async function correctShippingHallucination(
  provider: 'openai' | 'anthropic',
  model: string,
  currentMessages: ChatMessage[],
  offendingResponse: string
): Promise<string> {
  const correctionPrompt = [
    'Tu respuesta anterior mencionó una cifra o dijo "gratis"/"sin costo" de envío,',
    'pero la tool check_shipping_zones no devolvió ningún costo real (zones: []).',
    'Esa cifra es inventada y no debe llegar al cliente.',
    '',
    `Respuesta a corregir: "${offendingResponse}"`,
    '',
    'Reescribe ÚNICAMENTE esa respuesta, sin mencionar ningún monto de',
    'envío (ni "$0", ni "gratis", ni ninguna cifra). En su lugar di que',
    'el costo se calcula en la página de pago según la dirección. Mantén',
    'el resto del contenido (productos, precios de producto, preguntas',
    'al cliente) igual — solo corrige la parte de envío. Responde',
    'ÚNICAMENTE con el texto corregido, sin explicaciones adicionales.',
  ].join('\n');

  const response = await chat({
    provider,
    model,
    messages: [...currentMessages, { role: 'user', content: correctionPrompt }],
    maxTokens: 512,
    temperature: 0,
  });

  return response.content.trim() || offendingResponse;
}

/**
 * Returns true if a tool result from a check_shipping_zones call (matched by
 * `.includes()` to cover the `mcp_{server}_{tool}` naming prefix) reports an
 * empty zones list.
 */
export function isEmptyShippingZonesResult(toolName: string, resultContent: string): boolean {
  if (!toolName.includes('check_shipping_zones')) return false;
  try {
    const parsed = JSON.parse(resultContent) as { zones?: unknown };
    return Array.isArray(parsed.zones) && parsed.zones.length === 0;
  } catch {
    return false;
  }
}
