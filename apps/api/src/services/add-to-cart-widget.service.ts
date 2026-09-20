import { randomUUID } from 'crypto';
import type { ToolDefinition } from './llm.service';
import { query } from '../config/database';
import { redis } from '../config/redis';

/**
 * Tool nativa `add_to_cart_widget`: agrega un producto al carrito REAL de una tienda
 * Tiendanube desde el widget storefront (gensmart-tiendanube-widget).
 *
 * A diferencia de `send_media`, el backend NO ejecuta la acción: `nube.send("cart:add")`
 * solo existe dentro del Web Worker de NubeSDK. Flujo (espera bloqueante):
 *   1. La tool inserta un mensaje `assistant` invisible con `metadata.cart_action`
 *      y deja un registro pendiente en Redis (`cart:pending:{request_id}`).
 *   2. El widget lo recibe por su long-poll de GET /messages, ejecuta cart:add y escucha
 *      cart:add:success / cart:add:fail.
 *   3. El widget reporta con POST /api/widget/:agentId/cart-result → `recordCartResult()`
 *      guarda el resultado en Redis (`cart:result:{request_id}`).
 *   4. Este handler espera ese resultado (poll de Redis cada 400ms, máx. CART_WAIT_TIMEOUT_MS)
 *      y se lo devuelve al LLM en el mismo turno.
 * La misma infraestructura sirve a `remove_from_cart_widget` (remove-from-cart-widget.service.ts):
 * `runCartWidgetAction(kind, ...)` es compartida y el tipo de acción viaja en `metadata.cart_action.action`
 * ('add' | 'remove'; ausente = 'add', por compatibilidad con mensajes anteriores).
 * Se eligió espera bloqueante (no fire-and-forget) porque el widget ya está en long-poll
 * durante el turno y así el agente confirma con certeza real, sin estado "pendiente".
 */

export const ADD_TO_CART_TOOL_NAME = 'add_to_cart_widget';

/** Espera máxima del resultado del widget. El widget usa 8s para los eventos de NubeSDK. */
export const CART_WAIT_TIMEOUT_MS = 15_000;
const CART_POLL_INTERVAL_MS = 400;
const CART_KEY_TTL_SECONDS = 120;
export const MAX_QUANTITY = 99;

// Anti-loop del LLM: máx. 10 llamadas por conversación cada 10 minutos.
const CART_RATE_LIMIT = { maxCalls: 10, windowSeconds: 600 } as const;

const pendingKey = (requestId: string) => `cart:pending:${requestId}`;
const resultKey = (requestId: string) => `cart:result:${requestId}`;

/** Tool definition — what the LLM sees */
export const addToCartWidgetToolDef: ToolDefinition = {
  name: ADD_TO_CART_TOOL_NAME,
  description: [
    'Adds a product to the shopper\'s REAL store cart (the one shown in the store header) while they browse the Tiendanube storefront.',
    'Use it when the shopper clearly asks to add a product to their cart.',
    'You MUST pass the real numeric product_id AND variant_id. If the product has several variants, first ask the shopper which one they want',
    'and get the variant_id from the Tiendanube product tools (get_product returns each variant with its variant_id). NEVER guess a variant_id.',
    'The tool waits (up to ~15 seconds) for the storefront to confirm and returns the real outcome: only tell the shopper the product was added if the result says so.',
    'If it fails or cannot be confirmed, do NOT retry in a loop: offer to create the order with create_draft_order and share its checkout_url instead.',
  ].join(' '),
  parameters: {
    type: 'object',
    properties: {
      product_id: { type: 'integer', description: 'Tiendanube product id (numeric)' },
      variant_id: { type: 'integer', description: 'Tiendanube variant id (numeric) of the chosen variant' },
      quantity: { type: 'integer', description: `Units to add (1-${MAX_QUANTITY})` },
      properties: {
        type: 'object',
        description: 'Optional custom data attached to the cart line (persists into the order)',
      },
    },
    required: ['product_id', 'variant_id', 'quantity'],
  },
};

export type CartActionKind = 'add' | 'remove';

export interface AddToCartContext {
  conversationId: string;
  agentId: string;
  organizationId: string;
}

export interface AddToCartResult {
  success: boolean;
  message: string; // What the LLM sees as tool result
}

/** Resumen del ítem que reporta el widget (el backend solo lo usa para armar el mensaje al LLM). */
export interface CartResultItem {
  name?: string;
  quantity?: number;
  variant_values?: string;
}

interface StoredCartResult {
  success: boolean;
  reason?: 'fail' | 'timeout' | 'not_in_cart';
  item?: CartResultItem;
}

export function toPositiveInt(value: unknown): number | null {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkCartRateLimit(conversationId: string): Promise<boolean> {
  const key = `rl:cart:${conversationId}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, CART_RATE_LIMIT.windowSeconds);
  return count <= CART_RATE_LIMIT.maxCalls;
}

async function waitForCartResult(requestId: string, timeoutMs: number): Promise<StoredCartResult | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const raw = await redis.get(resultKey(requestId));
    if (raw) {
      try {
        return JSON.parse(raw) as StoredCartResult;
      } catch {
        return null;
      }
    }
    await sleep(CART_POLL_INTERVAL_MS);
  }
  return null;
}

export async function handleAddToCartWidget(
  args: Record<string, unknown>,
  context: AddToCartContext
): Promise<AddToCartResult> {
  const productId = toPositiveInt(args['product_id']);
  const variantId = toPositiveInt(args['variant_id']);
  const quantity = toPositiveInt(args['quantity']);

  if (!productId) {
    return { success: false, message: 'Falta un product_id numérico válido. Obtén el producto con las tools de Tiendanube y vuelve a llamar.' };
  }
  if (!variantId) {
    return {
      success: false,
      message:
        'Falta variant_id. Consulta las variantes del producto con get_product (Tiendanube), pregunta al comprador cuál quiere si hay varias, y vuelve a llamar con el variant_id real. No lo adivines.',
    };
  }
  if (!quantity || quantity > MAX_QUANTITY) {
    return { success: false, message: `quantity debe ser un entero entre 1 y ${MAX_QUANTITY}.` };
  }

  const properties =
    args['properties'] && typeof args['properties'] === 'object' && !Array.isArray(args['properties'])
      ? (args['properties'] as Record<string, unknown>)
      : undefined;

  return runCartWidgetAction('add', { productId, variantId, quantity, properties }, context);
}

/**
 * Núcleo compartido de add/remove: rate limit → pending en Redis → mensaje invisible con
 * `metadata.cart_action` → aviso WebSocket → espera bloqueante del resultado del widget.
 */
export async function runCartWidgetAction(
  kind: CartActionKind,
  input: { productId: number; variantId: number; quantity: number; properties?: Record<string, unknown> },
  context: AddToCartContext
): Promise<AddToCartResult> {
  const { productId, variantId, quantity, properties } = input;

  if (!(await checkCartRateLimit(context.conversationId))) {
    return {
      success: false,
      message:
        kind === 'add'
          ? 'Se alcanzó el límite de intentos de agregar al carrito en esta conversación. Ofrece crear el pedido con create_draft_order y compartir el checkout_url.'
          : 'Se alcanzó el límite de acciones sobre el carrito en esta conversación. Pídele al comprador que quite el producto manualmente desde su carrito.',
    };
  }

  const requestId = randomUUID();
  const cartAction: Record<string, unknown> = {
    action: kind,
    request_id: requestId,
    product_id: productId,
    variant_id: variantId,
    quantity,
  };
  if (properties) cartAction['properties'] = properties;

  // 1. Registro pendiente: solo un request_id conocido puede recibir resultado (ver recordCartResult).
  await redis.set(
    pendingKey(requestId),
    JSON.stringify({ conversationId: context.conversationId, agentId: context.agentId, action: kind }),
    'EX',
    CART_KEY_TTL_SECONDS
  );

  // 2. Mensaje invisible para el usuario: el widget lo consume del long-poll de GET /messages.
  const msgResult = await query<{ id: string; created_at: string }>(
    `INSERT INTO messages (conversation_id, role, content, metadata, created_at)
     VALUES ($1, 'assistant', '', $2, NOW())
     RETURNING id, created_at`,
    [context.conversationId, JSON.stringify({ cart_action: cartAction })]
  );

  // 3. Igual que send_media: aviso en tiempo real al dashboard.
  try {
    const { getIO } = await import('../config/websocket');
    const io = getIO();
    const row = msgResult.rows[0];
    const payload = {
      conversationId: context.conversationId,
      messages: [
        {
          id: row?.id,
          role: 'assistant',
          content: '',
          metadata: { cart_action: cartAction },
          createdAt: row?.created_at,
        },
      ],
    };
    io.to(`org:${context.organizationId}`).emit('message:new', payload);
    io.to(`conv:${context.conversationId}`).emit('message:new', payload);
  } catch {
    // WebSocket may not be initialized — non-fatal
  }

  // 4. Espera bloqueante del resultado real desde el widget.
  const result = await waitForCartResult(requestId, CART_WAIT_TIMEOUT_MS);
  await redis.del(pendingKey(requestId), resultKey(requestId)).catch(() => undefined);

  if (!result) {
    console.warn(`[cart-widget] Timeout sin resultado del widget. action=${kind} request=${requestId} conv=${context.conversationId}`);
    return {
      success: false,
      message:
        kind === 'add'
          ? 'No se pudo confirmar si el producto quedó en el carrito (el widget no respondió a tiempo; puede que el comprador no esté en la tienda). No afirmes que se agregó. Pídele que revise su carrito, y ofrece crear el pedido con create_draft_order y compartir el checkout_url.'
          : 'No se pudo confirmar si el producto se sacó del carrito (el widget no respondió a tiempo; puede que el comprador no esté en la tienda). No afirmes que se sacó. Pídele que revise su carrito.',
    };
  }

  const name = result.item?.name ? ` "${result.item.name}"` : '';
  const variant = result.item?.variant_values ? ` (${result.item.variant_values})` : '';

  if (result.success) {
    return {
      success: true,
      message:
        kind === 'add'
          ? `Confirmado: el producto${name}${variant} x${result.item?.quantity ?? quantity} quedó agregado al carrito real de la tienda. Confírmaselo al comprador de forma natural.`
          : `Confirmado: se sacó del carrito real de la tienda el producto${name}${variant} x${result.item?.quantity ?? quantity}. Confírmaselo al comprador de forma natural.`,
    };
  }

  if (kind === 'remove' && result.reason === 'not_in_cart') {
    return {
      success: false,
      message:
        'Ese producto/variante no está en el carrito real del comprador (no hay nada que sacar). No reintentes: díselo y pregúntale qué quiere hacer.',
    };
  }

  return {
    success: false,
    message:
      kind === 'add'
        ? 'La tienda rechazó agregar el producto al carrito (no informa el motivo; puede ser stock, variante inválida u otro). No reintentes en bucle: explícalo brevemente y ofrece crear el pedido con create_draft_order y compartir el checkout_url.'
        : 'La tienda rechazó sacar el producto del carrito (no informa el motivo; puede que la cantidad sea mayor a la que hay en el carrito u otro). No reintentes en bucle: explícalo brevemente y pídele que lo quite manualmente desde su carrito.',
  };
}

export type RecordCartResultOutcome = 'ok' | 'unknown_request';

/**
 * Registra el resultado que reporta el widget (POST /api/widget/:agentId/cart-result).
 * Solo se acepta para un request_id pendiente que pertenezca a esa conversación y agente;
 * el primer resultado gana (NX), así un doble POST no pisa el resultado.
 */
export async function recordCartResult(params: {
  agentId: string;
  sessionId: string;
  requestId: string;
  success: boolean;
  reason?: unknown;
  item?: unknown;
}): Promise<RecordCartResultOutcome> {
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

  const stored: StoredCartResult = { success: params.success };
  if (params.reason === 'fail' || params.reason === 'timeout' || params.reason === 'not_in_cart') {
    stored.reason = params.reason;
  }
  if (params.item && typeof params.item === 'object') {
    const i = params.item as Record<string, unknown>;
    stored.item = {
      ...(typeof i['name'] === 'string' ? { name: i['name'].slice(0, 200) } : {}),
      ...(typeof i['quantity'] === 'number' ? { quantity: i['quantity'] } : {}),
      ...(typeof i['variant_values'] === 'string' ? { variant_values: i['variant_values'].slice(0, 200) } : {}),
    };
  }

  await redis.set(resultKey(params.requestId), JSON.stringify(stored), 'EX', CART_KEY_TTL_SECONDS, 'NX');
  return 'ok';
}
