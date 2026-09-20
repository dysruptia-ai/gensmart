import { randomUUID } from 'crypto';
import type { ToolDefinition } from './llm.service';
import { query } from '../config/database';
import { redis } from '../config/redis';
import type { AddToCartContext, AddToCartResult } from './add-to-cart-widget.service';

/**
 * Tool nativa `get_cart_widget`: LECTURA del carrito real del comprador en el storefront Tiendanube.
 * Existe para que el LLM no dependa de su memoria conversacional (que queda desactualizada si un
 * add/remove salió ambiguo). Mismo mecanismo que add/remove (pending en Redis + mensaje invisible +
 * espera bloqueante), pero con `metadata.cart_query` (no `cart_action`) y respuesta en
 * POST /api/widget/:agentId/cart-state con la lista completa de ítems.
 * Leer `nube.getState().cart` es síncrono en el widget: no espera ningún evento de NubeSDK, por eso el
 * timeout es menor que el de add/remove (el grueso de la latencia es el long-poll de /messages).
 */

export const GET_CART_TOOL_NAME = 'get_cart_widget';

export const CART_QUERY_TIMEOUT_MS = 8_000;
const CART_QUERY_POLL_INTERVAL_MS = 200;
const CART_QUERY_KEY_TTL_SECONDS = 60;
const CART_QUERY_RATE_LIMIT = { maxCalls: 20, windowSeconds: 600 } as const;
const MAX_CART_ITEMS = 100;

const pendingKey = (requestId: string) => `cartq:pending:${requestId}`;
const resultKey = (requestId: string) => `cartq:result:${requestId}`;

export const getCartWidgetToolDef: ToolDefinition = {
  name: GET_CART_TOOL_NAME,
  description: [
    'Reads the shopper\'s REAL store cart right now (the one shown in the store header): the exact products, variants and quantities currently in it.',
    'It takes no parameters and has no side effects, so you can call it whenever you need certainty.',
    'Call it BEFORE telling the shopper what is in their cart, before moving on to checkout/delivery details, and whenever an add/remove result was not confirmed or you are unsure of the cart state.',
    'NEVER rely on your own memory of earlier add/remove results to describe the cart: the cart can change without you (the shopper edits it, or an action failed silently).',
    'If the product the shopper wants is not in the cart, add it again with add_to_cart_widget.',
  ].join(' '),
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export interface CartStateItem {
  product_id?: number;
  variant_id?: number;
  quantity?: number;
  name?: string;
  variant_values?: string;
}

interface StoredCartState {
  items: CartStateItem[];
  subtotal?: number;
  total?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkRateLimit(conversationId: string): Promise<boolean> {
  const key = `rl:cartq:${conversationId}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, CART_QUERY_RATE_LIMIT.windowSeconds);
  return count <= CART_QUERY_RATE_LIMIT.maxCalls;
}

async function waitForState(requestId: string, timeoutMs: number): Promise<StoredCartState | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const raw = await redis.get(resultKey(requestId));
    if (raw) {
      try {
        return JSON.parse(raw) as StoredCartState;
      } catch {
        return null;
      }
    }
    await sleep(CART_QUERY_POLL_INTERVAL_MS);
  }
  return null;
}

function formatCart(state: StoredCartState): string {
  if (state.items.length === 0) {
    return 'El carrito real del comprador está VACÍO ahora mismo (0 productos). No hay nada agregado: si el comprador quiere un producto, agrégalo con add_to_cart_widget. No afirmes que hay algo en el carrito.';
  }
  const lines = state.items.map((i) => {
    const name = i.name ?? `producto ${i.product_id ?? '?'}`;
    const variant = i.variant_values ? ` (${i.variant_values})` : '';
    const ids = `product_id=${i.product_id ?? '?'}, variant_id=${i.variant_id ?? '?'}`;
    return `- ${name}${variant} x${i.quantity ?? '?'} [${ids}]`;
  });
  const totals: string[] = [];
  if (typeof state.subtotal === 'number') totals.push(`subtotal ${state.subtotal}`);
  if (typeof state.total === 'number') totals.push(`total ${state.total}`);
  return [
    'Estado REAL del carrito del comprador ahora mismo:',
    ...lines,
    ...(totals.length > 0 ? [`(${totals.join(', ')})`] : []),
    'Usa exactamente esta lista como fuente de verdad, no tu memoria de la conversación.',
  ].join('\n');
}

export async function handleGetCartWidget(context: AddToCartContext): Promise<AddToCartResult> {
  if (!(await checkRateLimit(context.conversationId))) {
    return {
      success: false,
      message:
        'Se alcanzó el límite de consultas del carrito en esta conversación. Pídele al comprador que revise su carrito directamente.',
    };
  }

  const requestId = randomUUID();

  await redis.set(
    pendingKey(requestId),
    JSON.stringify({ conversationId: context.conversationId, agentId: context.agentId }),
    'EX',
    CART_QUERY_KEY_TTL_SECONDS
  );

  await query(
    `INSERT INTO messages (conversation_id, role, content, metadata, created_at)
     VALUES ($1, 'assistant', '', $2, NOW())`,
    [context.conversationId, JSON.stringify({ cart_query: { request_id: requestId } })]
  );

  const state = await waitForState(requestId, CART_QUERY_TIMEOUT_MS);
  await redis.del(pendingKey(requestId), resultKey(requestId)).catch(() => undefined);

  if (!state) {
    console.warn(`[cart-widget] Timeout sin estado del carrito. request=${requestId} conv=${context.conversationId}`);
    return {
      success: false,
      message:
        'No se pudo leer el carrito (el widget no respondió a tiempo; puede que el comprador no esté en la tienda). No afirmes qué hay en el carrito. Pídele que lo revise y ofrece crear el pedido con create_draft_order.',
    };
  }

  return { success: true, message: formatCart(state) };
}

export type RecordCartStateOutcome = 'ok' | 'unknown_request';

/**
 * Registra el estado del carrito que reporta el widget (POST /api/widget/:agentId/cart-state).
 * Solo se acepta para un request_id pendiente de esa conversación y agente; el primero gana (NX).
 */
export async function recordCartState(params: {
  agentId: string;
  sessionId: string;
  requestId: string;
  items: unknown;
  subtotal?: unknown;
  total?: unknown;
}): Promise<RecordCartStateOutcome> {
  const raw = await redis.get(pendingKey(params.requestId));
  if (!raw) return 'unknown_request';

  let pending: { conversationId?: string; agentId?: string };
  try {
    pending = JSON.parse(raw) as { conversationId?: string; agentId?: string };
  } catch {
    return 'unknown_request';
  }
  if (pending.conversationId !== params.sessionId || pending.agentId !== params.agentId) {
    return 'unknown_request';
  }

  const items: CartStateItem[] = [];
  if (Array.isArray(params.items)) {
    for (const entry of params.items.slice(0, MAX_CART_ITEMS)) {
      if (!entry || typeof entry !== 'object') continue;
      const i = entry as Record<string, unknown>;
      items.push({
        ...(typeof i['product_id'] === 'number' ? { product_id: i['product_id'] } : {}),
        ...(typeof i['variant_id'] === 'number' ? { variant_id: i['variant_id'] } : {}),
        ...(typeof i['quantity'] === 'number' ? { quantity: i['quantity'] } : {}),
        ...(typeof i['name'] === 'string' ? { name: i['name'].slice(0, 200) } : {}),
        ...(typeof i['variant_values'] === 'string' ? { variant_values: i['variant_values'].slice(0, 200) } : {}),
      });
    }
  }

  const stored: StoredCartState = {
    items,
    ...(typeof params.subtotal === 'number' ? { subtotal: params.subtotal } : {}),
    ...(typeof params.total === 'number' ? { total: params.total } : {}),
  };

  await redis.set(resultKey(params.requestId), JSON.stringify(stored), 'EX', CART_QUERY_KEY_TTL_SECONDS, 'NX');
  return 'ok';
}
