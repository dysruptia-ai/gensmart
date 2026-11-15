/**
 * Dropi sales toolkit — orchestration (Redis, Postgres and the MCP calls to Dropi).
 *
 * Security model (see core.ts for the pure rules):
 * - The LLM never decides price, carrier, rate_type or whether an order is created: everything comes
 *   from the quote stored server side under the conversation's scope.
 * - Every Redis key carries the scope (conversation id, or preview session id) and every stored
 *   object repeats it; it is checked again on read.
 * - Every dropi_orders query filters by agent_id and organization_id.
 * - Buyer identity (order ownership, tracking verification) never depends on data the buyer or the
 *   LLM can write (contacts.phone, captured variables, tool arguments): only wa_from (Meta's signed
 *   webhook) on WhatsApp, else the conversation / preview session itself.
 * - Order creation is capped per conversation, per buyer phone and per agent (counted in
 *   dropi_orders under a per-agent lock, in the same transaction as the insert).
 * - Outputs to the LLM are whitelisted objects with neutral Spanish messages; details go to the log
 *   with ids only (never names, phones or addresses).
 *
 * All side effects go through `DropiSalesDeps` (real ones by default, fakes in tests).
 */

import { randomUUID } from 'crypto';
import {
  buyerRepliedSince,
  classifyCreateOrderResult,
  isAffirmative,
  receivedAfterSummary,
  resolveMaxDailyOrders,
  orderCapDecision,
  cleanText,
  datePart,
  describeVariation,
  findShippingCompany,
  hasPositiveMargin,
  isoDatePlusDays,
  last10Digits,
  longestWord,
  matchCategory,
  normalizeForSearch,
  normalizeKey,
  parseCities,
  parseGetOrder,
  parseListProducts,
  parseNamedItems,
  parseQuote,
  presentOptions,
  presentOrder,
  presentProducts,
  productPrice,
  provisionalTotal,
  rankCarriers,
  resolveCity,
  resolveMarginPercent,
  safeParseJson,
  twoPassTotal,
  validSupplierCost,
  type BuyerIdentity,
  type CarrierOption,
  type DropiProduct,
  type NamedItem,
  type OrderForLlm,
  type ParsedOrder,
} from './core';

// ── Context and dependencies ─────────────────────────────────────────────────

export interface McpCallResult {
  content: string;
  isError: boolean;
}

/** Per-turn context. Built by the worker / preview from the Dropi tool's OAuth binding. */
export interface DropiSalesContext {
  /** Calls a Dropi MCP tool with that tool's headers + OAuth context (refresh, 401 retry, revocation). */
  call: (tool: string, args: Record<string, unknown>) => Promise<McpCallResult>;
  /** Neutral text the OAuth wrapper returns when the session is unusable. */
  unavailableMessage: string;
  toolId: string;
  agentId: string;
  organizationId: string;
  /** Isolation scope for Redis: conversation id (worker) or preview session id (preview). */
  scopeId: string;
  /** Real conversation id, null in preview (no conversations row). */
  conversationId: string | null;
  /** Preview session id, null in the worker. */
  previewSessionId: string | null;
  /** Recorded on the order row for the dashboard only; NEVER used as an identity. */
  contactId: string | null;
  channel: string;
  /**
   * WhatsApp only: conversations.channel_metadata.wa_from — the sender number of Meta's signed
   * webhook, written once by routes/whatsapp.ts. Null elsewhere (then the channel behaves as web).
   */
  waFrom: string | null;
  /** User messages saved in the conversation + the one being processed (see buyerRepliedSince). */
  currentUserTurn: number;
  /** Server receipt time (ms) of the newest buyer message being processed; null when unknown. */
  currentMessageReceivedAt: number | null;
  /** Text of the buyer's last message in this turn (isAffirmative). */
  lastBuyerMessage: string;
  /** Mutable per-turn state: the token prepared in this turn (stamped by markSummaryDelivered). */
  turn: { preparedToken: string | null };
}

export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  /** SET NX EX; true when the key was set. */
  setNx(key: string, value: string, ttlSeconds: number): Promise<boolean>;
  del(key: string): Promise<void>;
  /** INCR, setting the TTL on the first increment. */
  incrWithTtl(key: string, ttlSeconds: number): Promise<number>;
  hget(key: string, field: string): Promise<string | null>;
  hsetWithTtl(key: string, entries: Record<string, string>, ttlSeconds: number): Promise<void>;
}

export interface DropiOrderRecord {
  id: string;
  externalOrderId: string | null;
  statusLocal: 'creada' | 'desconocido';
  statusCached: string | null;
  total: number;
  currency: string;
  items: StoredOrderItem[];
  createdAt: string;
}

export interface StoredOrderItem {
  producto_id: number;
  opcion_id: number | null;
  nombre: string;
  opcion: string | null;
  cantidad: number;
  precio_unitario: number;
}

export interface NewOrderRow {
  id: string;
  organizationId: string;
  agentId: string;
  conversationId: string | null;
  previewSessionId: string | null;
  contactId: string | null;
  total: number;
  currency: string;
  items: StoredOrderItem[];
  cityName: string;
  buyerPhoneLast10: string;
  /** last10(wa_from) on WhatsApp, else null. */
  ownerWaLast10: string | null;
}

export interface OrderLimits {
  perConversation: number;
  perPhone: number;
  perAgent: number;
}

export type InsertWithinLimitsOutcome =
  | { ok: true }
  | { ok: false; reason: 'verifying' | 'conversation_cap' | 'phone_cap' | 'agent_cap' };

export interface OrdersRepository {
  /**
   * Atomically (per-agent lock, same transaction): counts the rows of the last 24 h — 'desconocido'
   * ones included — decides with core.orderCapDecision and, when allowed, inserts the row as
   * 'desconocido' so concurrent confirmations already see it.
   */
  insertPendingWithinLimits(row: NewOrderRow, limits: OrderLimits): Promise<InsertWithinLimitsOutcome>;
  markCreated(input: { id: string; agentId: string; externalOrderId: string; status: string | null; carrierId: number }): Promise<void>;
  markUnknown(input: { id: string; agentId: string; carrierId: number }): Promise<void>;
  /** Deletes a row that never got an external id (definitive failure). */
  deletePending(id: string, agentId: string): Promise<void>;
  findOwnRecent(owner: BuyerIdentity, limit: number): Promise<DropiOrderRecord[]>;
  findOwnByNumber(owner: BuyerIdentity, externalOrderId: string): Promise<DropiOrderRecord | null>;
  updateStatusCached(input: { agentId: string; organizationId: string; externalOrderId: string; status: string }): Promise<void>;
}

export interface CapNotice {
  organizationId: string;
  agentId: string;
  reason: 'conversation_cap' | 'phone_cap' | 'agent_cap';
}

export interface DropiSalesLog {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
}

export interface DropiSalesDeps {
  kv: KeyValueStore;
  orders: OrdersRepository;
  /**
   * Raw agent configuration value (value or schema default) — porcentaje_margen,
   * max_pedidos_diarios; validated by resolveMarginPercent / resolveMaxDailyOrders.
   */
  loadConfigValue(agentId: string, key: string): Promise<unknown>;
  /** Dashboard notification to the organization (deduplicated by the caller). */
  notifyCapReached(notice: CapNotice): Promise<void>;
  log: DropiSalesLog;
  randomId(): string;
  now(): Date;
}

// ── Constants ────────────────────────────────────────────────────────────────

/** Agent configuration keys read by the sales tools (the "Vendedor Dropi" template uses the same). */
export const DROPI_CONFIG_KEYS = {
  marginPercent: 'porcentaje_margen',
  maxDailyOrders: 'max_pedidos_diarios',
} as const;

export const TTL = {
  catalog: 60 * 60,
  products: 2 * 60 * 60,
  quote: 30 * 60,
  pending: 30 * 60,
  confirmLock: 24 * 60 * 60,
  confirmed: 24 * 60 * 60,
  rateWindow: 60 * 60,
  capNotice: 60 * 60,
} as const;

export const LIMITS = {
  quotesPerHour: 30,
  lookupsPerOrderPerHour: 5,
  /** Extra cap on verified lookups per conversation (any number), against enumeration. */
  lookupsPerHour: 20,
  maxCarrierAttempts: 3,
  maxQuantity: 10,
  /** Orders (any state) per conversation / preview session in 24 h. */
  ordersPerConversation: 2,
  /** Orders per buyer phone (buyer_phone_last10) and agent in 24 h. */
  ordersPerPhone: 2,
  /** Verified (not own) order lookups per agent and hour, across conversations. */
  lookupsPerAgentPerHour: 30,
  /** Verified (not own) lookups per agent and target phone per hour. */
  lookupsPerAgentPhonePerHour: 5,
} as const;

const PAYMENT = 'contra entrega';
const CURRENCY = 'COP';

export const MSG = {
  unavailable: 'No pude consultar el catálogo en este momento. Intenta de nuevo en unos minutos.',
  notAvailableCountry: 'Este catálogo no está disponible en este momento.',
  searchFirst: 'Busca el producto primero con dropi_buscar_productos.',
  noResults: 'Pide al cliente que describa el producto con otras palabras',
  unknownCategory: 'Esa categoría no existe. Usa dropi_listar_categorias para ver las disponibles.',
  optionRequired: 'Este producto tiene opciones: pide al cliente que elija una (usa dropi_ver_opciones) y envía su opcion_id.',
  optionInvalid: 'Esa opción no existe para este producto. Usa dropi_ver_opciones.',
  noStock: 'No hay unidades suficientes de este producto para esa cantidad.',
  notSellable: 'Este producto no está disponible para la venta en este momento.',
  quoteRateLimited: 'Se alcanzó el límite de cotizaciones por ahora. Intenta más tarde.',
  quoteRejected: 'No pude cotizar este envío en este momento. Ofrece al cliente otro producto o intenta más tarde.',
  quoteNotFound: 'La cotización no existe o expiró. Vuelve a cotizar con dropi_cotizar_envio.',
  pendingNotFound: 'El pedido no existe o expiró. Vuelve a preparar el pedido con dropi_preparar_pedido.',
  pendingReplaced: 'Ese pedido fue reemplazado por uno más reciente. Usa el último pedido_token de dropi_preparar_pedido.',
  // No message promises a proactive contact: nobody writes to the buyer on their own (the buyer
  // taps request_human_handoff's button). ofrecer_asesor tells the agent to offer it.
  orderCapReached: 'En este momento no puedo registrar más pedidos por este medio. Si quieres, te puedo conectar con una persona del equipo para ayudarte.',
  previousVerifying: 'Tu pedido anterior está en verificación, así que no es necesario hacer otro. Puedes consultar su estado más tarde y, si quieres, te conecto con una persona del equipo.',
  confirmInstruction:
    'Muestra este resumen al cliente y pide su confirmación explícita. Solo cuando responda, llama a dropi_confirmar_pedido.',
  needsConfirmation: 'El cliente aún no ha confirmado. Muéstrale el resumen y espera su respuesta antes de confirmar.',
  processing: 'Tu pedido se está procesando. Espera un momento y vuelve a consultarlo.',
  orderFailed: 'No pude crear el pedido en este momento. Ofrece al cliente intentarlo más tarde o con otra dirección.',
  orderVerifying: 'Estamos verificando tu pedido. Puedes consultar su estado más tarde y, si quieres, te conecto con una persona del equipo.',
  orderNotFound: 'No encontré un pedido con esos datos',
  lookupRateLimited: 'Se alcanzó el límite de consultas de pedidos por ahora. Intenta más tarde.',
  phoneRequired: 'Para consultar ese pedido necesito el teléfono con el que se hizo.',
  noOwnOrders: 'No encontré pedidos de este cliente. Pide su número de pedido y el teléfono con el que lo hizo.',
  trackingUnavailable: 'No pude consultar el estado del pedido en este momento. Intenta de nuevo más tarde.',
} as const;

// ── Keys (always scoped) ─────────────────────────────────────────────────────

export const keys = {
  catalog: (toolId: string, kind: 'carriers' | 'departments' | 'categories') => `dropi:catalog:${toolId}:${kind}`,
  products: (scope: string) => `dropi:products:${scope}`,
  quote: (scope: string, id: string) => `dropi:quote:${scope}:${id}`,
  pending: (scope: string, token: string) => `dropi:pending:${scope}:${token}`,
  /** The ONE live pending order of the scope (token); preparing again replaces it. */
  pendingCurrent: (scope: string) => `dropi:pending-current:${scope}`,
  confirmLock: (scope: string, token: string) => `dropi:confirm-lock:${scope}:${token}`,
  confirmed: (scope: string, token: string) => `dropi:confirmed:${scope}:${token}`,
  quoteRate: (scope: string) => `dropi:rl:quote:${scope}`,
  lookupRate: (scope: string, orderNumber: string) => `dropi:rl:order:${scope}:${orderNumber}`,
  lookupRateAll: (scope: string) => `dropi:rl:order-all:${scope}`,
  lookupRateAgent: (agentId: string) => `dropi:rl:order-agent:${agentId}`,
  lookupRateAgentPhone: (agentId: string, phoneLast10: string) => `dropi:rl:order-agent-phone:${agentId}:${phoneLast10}`,
  capNotice: (agentId: string, reason: string) => `dropi:cap-notice:${agentId}:${reason}`,
};

// ── Stored shapes ────────────────────────────────────────────────────────────

interface CachedProduct {
  scope: string;
  product: DropiProduct;
}

export interface StoredQuote {
  scope: string;
  agentId: string;
  product: {
    id: number;
    name: string;
    type: 'SIMPLE' | 'VARIABLE';
    variationId: number | null;
    option: string | null;
    /** sale_price of product / variation: server only. */
    supplierCost: number;
  };
  quantity: number;
  unitPrice: number;
  subtotal: number;
  shipping: number;
  total: number;
  chargedUnitPrice: number;
  city: { id: number; name: string; departmentId: number | null; departmentName: string };
  /** Cheapest first; costs already include the 5 % safety margin when the 2nd quote failed. */
  carriers: CarrierOption[];
  currency: string;
}

interface StoredPending {
  scope: string;
  agentId: string;
  quoteId: string;
  quote: StoredQuote;
  buyer: {
    name: string;
    surname: string;
    address: string;
    phone: string;
    neighborhood: string | null;
    notes: string | null;
  };
  /** currentUserTurn when the summary was prepared. */
  markerTurn: number;
  /** Server time (ms) when dropi_preparar_pedido ran. */
  pendingCreatedAt: number;
  /** Server time (ms) when the turn that showed the summary finished (assistant message saved). */
  summaryDeliveredAt: number | null;
}

function parseStored<T extends { scope: string; agentId?: string }>(raw: string | null, ctx: DropiSalesContext): T | null {
  const rec = safeParseJson(raw) as T | undefined;
  if (!rec || typeof rec !== 'object' || rec.scope !== ctx.scopeId) return null;
  if (rec.agentId !== undefined && rec.agentId !== ctx.agentId) return null;
  return rec;
}

const json = (value: unknown): string => JSON.stringify(value);
const neutral = (message: string): string => json({ error: message });

// ── Helpers ──────────────────────────────────────────────────────────────────

async function marginOf(ctx: DropiSalesContext, deps: DropiSalesDeps): Promise<number> {
  try {
    return resolveMarginPercent(await deps.loadConfigValue(ctx.agentId, DROPI_CONFIG_KEYS.marginPercent));
  } catch {
    return resolveMarginPercent(undefined);
  }
}

async function maxDailyOrdersOf(ctx: DropiSalesContext, deps: DropiSalesDeps): Promise<number> {
  try {
    return resolveMaxDailyOrders(await deps.loadConfigValue(ctx.agentId, DROPI_CONFIG_KEYS.maxDailyOrders));
  } catch {
    return resolveMaxDailyOrders(undefined);
  }
}

/** Buyer identity of this turn: wa_from on WhatsApp, else conversation / preview session. */
export function identityOf(ctx: DropiSalesContext): BuyerIdentity {
  return {
    agentId: ctx.agentId,
    organizationId: ctx.organizationId,
    waLast10: ctx.channel === 'whatsapp' ? last10Digits(ctx.waFrom) : null,
    conversationId: ctx.conversationId,
    previewSessionId: ctx.conversationId === null ? ctx.previewSessionId : null,
  };
}

/** Calls a Dropi tool and returns its content, or null on an error result (logged with ids only). */
async function callContent(ctx: DropiSalesContext, deps: DropiSalesDeps, tool: string, args: Record<string, unknown>): Promise<string | null> {
  try {
    const r = await ctx.call(tool, args);
    if (r.isError) {
      deps.log.warn(`[dropi-sales] ${tool} failed (tool ${ctx.toolId}, conversation ${ctx.scopeId})`);
      return null;
    }
    return r.content;
  } catch (err) {
    deps.log.warn(`[dropi-sales] ${tool} threw (tool ${ctx.toolId}, conversation ${ctx.scopeId}): ${(err as Error).name}`);
    return null;
  }
}

async function catalog(
  ctx: DropiSalesContext,
  deps: DropiSalesDeps,
  kind: 'carriers' | 'departments' | 'categories'
): Promise<NamedItem[] | null> {
  const key = keys.catalog(ctx.toolId, kind);
  const cached = safeParseJson(await deps.kv.get(key).catch(() => null));
  if (Array.isArray(cached)) return cached as NamedItem[];
  const tool = kind === 'carriers' ? 'list_carriers' : kind === 'departments' ? 'list_departments' : 'list_categories';
  const content = await callContent(ctx, deps, tool, {});
  const items = content === null ? null : parseNamedItems(content);
  if (!items || items.length === 0) return null;
  await deps.kv.set(key, json(items), TTL.catalog).catch(() => {});
  return items;
}

async function cachedProduct(ctx: DropiSalesContext, deps: DropiSalesDeps, productId: number): Promise<DropiProduct | null> {
  const raw = await deps.kv.hget(keys.products(ctx.scopeId), String(productId)).catch(() => null);
  return parseStored<CachedProduct>(raw, ctx)?.product ?? null;
}

// ── C.1 dropi_buscar_productos ───────────────────────────────────────────────

export async function searchProducts(
  ctx: DropiSalesContext,
  deps: DropiSalesDeps,
  input: { busqueda: string; categoria?: string }
): Promise<string> {
  const search = normalizeForSearch(input.busqueda);
  let category: string | undefined;
  if (input.categoria) {
    const categories = await catalog(ctx, deps, 'categories');
    if (!categories) return neutral(MSG.unavailable);
    const match = matchCategory(input.categoria, categories);
    if (!match) return neutral(MSG.unknownCategory);
    category = match;
  }

  const run = async (term: string) => {
    const content = await callContent(ctx, deps, 'list_products', {
      search: term,
      ...(category ? { category } : {}),
      page_size: 10,
      get_stock: true,
    });
    return content === null ? null : parseListProducts(content);
  };

  let result = await run(search);
  if (!result || !result.ok) return neutral(MSG.unavailable);
  if (result.currency !== CURRENCY) return neutral(MSG.notAvailableCountry);
  if (result.products.length === 0) {
    const retry = longestWord(search);
    if (retry) {
      const second = await run(retry);
      if (second && second.ok && second.currency === CURRENCY) result = second;
    }
  }

  const margin = await marginOf(ctx, deps);
  const shown = presentProducts(result.products, margin);
  if (shown.length === 0) return json({ productos: [], sugerencia: MSG.noResults });

  const entries: Record<string, string> = {};
  for (const p of result.products) {
    if (shown.some((s) => s.producto_id === p.id)) {
      entries[String(p.id)] = json({ scope: ctx.scopeId, product: p } satisfies CachedProduct);
    }
  }
  await deps.kv.hsetWithTtl(keys.products(ctx.scopeId), entries, TTL.products).catch((err: Error) =>
    deps.log.warn(`[dropi-sales] product cache write failed (conversation ${ctx.scopeId}): ${err.name}`)
  );
  return json({ productos: shown, moneda: CURRENCY });
}

// ── C.2 dropi_listar_categorias ──────────────────────────────────────────────

export async function listCategories(ctx: DropiSalesContext, deps: DropiSalesDeps): Promise<string> {
  const categories = await catalog(ctx, deps, 'categories');
  if (!categories) return neutral(MSG.unavailable);
  return json({ categorias: categories.map((c) => c.name).slice(0, 100) });
}

// ── C.3 dropi_ver_opciones ───────────────────────────────────────────────────

export async function viewOptions(
  ctx: DropiSalesContext,
  deps: DropiSalesDeps,
  input: { producto_id: number; filtro?: string }
): Promise<string> {
  const product = await cachedProduct(ctx, deps, input.producto_id);
  if (!product) return neutral(MSG.searchFirst);
  if (product.type === 'SIMPLE') return json({ producto_id: product.id, tiene_opciones: false, opciones: [] });
  const margin = await marginOf(ctx, deps);
  return json({ producto_id: product.id, opciones: presentOptions(product, margin, input.filtro) });
}

// ── C.4 dropi_cotizar_envio ──────────────────────────────────────────────────

interface QuoteRun {
  ranked: CarrierOption[];
  currency: string;
}

export async function quoteShipping(
  ctx: DropiSalesContext,
  deps: DropiSalesDeps,
  input: { producto_id: number; opcion_id?: number; cantidad: number; ciudad: string; departamento?: string }
): Promise<string> {
  const quantity = input.cantidad;
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > LIMITS.maxQuantity) {
    return neutral(`La cantidad debe ser un número entero entre 1 y ${LIMITS.maxQuantity}.`);
  }
  const product = await cachedProduct(ctx, deps, input.producto_id);
  if (!product) return neutral(MSG.searchFirst);

  const margin = await marginOf(ctx, deps);
  let variationId: number | null = null;
  let option: string | null = null;
  let unitPrice: number | null;
  let supplierCost: number | null;
  if (product.type === 'VARIABLE') {
    if (input.opcion_id === undefined) return neutral(MSG.optionRequired);
    const v = product.variations.find((x) => x.id === input.opcion_id);
    if (!v) return neutral(MSG.optionInvalid);
    if (v.stock < quantity) return neutral(MSG.noStock);
    variationId = v.id;
    option = describeVariation(v) || null;
    unitPrice = productPrice(v.suggestedPrice, margin);
    supplierCost = v.salePrice;
  } else {
    if (product.stock < quantity) return neutral(MSG.noStock);
    unitPrice = productPrice(product.suggestedPrice, margin);
    supplierCost = product.salePrice;
  }
  if (unitPrice === null) return neutral(MSG.notSellable);
  if (!validSupplierCost(supplierCost)) {
    deps.log.warn(`[dropi-sales] product ${product.id} has no supplier cost; quote refused (conversation ${ctx.scopeId})`);
    return neutral(MSG.notSellable);
  }

  const count = await deps.kv.incrWithTtl(keys.quoteRate(ctx.scopeId), TTL.rateWindow).catch(() => 0);
  if (count > LIMITS.quotesPerHour) return neutral(MSG.quoteRateLimited);

  // City
  const citiesContent = await callContent(ctx, deps, 'search_cities', { name: normalizeKey(input.ciudad) });
  const cities = citiesContent === null ? null : parseCities(citiesContent);
  if (!cities) return neutral(MSG.unavailable);
  if (cities.length === 0) return json({ ciudad_no_encontrada: true });
  const departments = await catalog(ctx, deps, 'departments');
  if (!departments) return neutral(MSG.unavailable);
  const resolved = resolveCity({ query: input.ciudad, cities, departments, department: input.departamento });
  if (resolved.kind === 'not_found') return json({ ciudad_no_encontrada: true });
  if (resolved.kind === 'needs_department') return json({ necesita_departamento: true, opciones: resolved.options });
  const { city, departmentName } = resolved;

  const carriersCatalog = await catalog(ctx, deps, 'carriers');
  if (!carriersCatalog) return neutral(MSG.unavailable);

  const subtotal = unitPrice * quantity;
  const quoteWith = async (price: number): Promise<QuoteRun | null> => {
    const content = await callContent(ctx, deps, 'quote_shipping', {
      cash_on_delivery: true,
      destination_city: {
        id: city.id,
        ...(city.daneCode ? { dane_code: city.daneCode } : {}),
        zip_code: city.zipCode || null,
      },
      products: [
        {
          id: product.id,
          type: product.type,
          quantity,
          price,
          ...(variationId !== null ? { variation_id: variationId } : {}),
        },
      ],
    });
    if (content === null) return null;
    const parsed = parseQuote(content);
    if (!parsed.ok) return null;
    return { ranked: rankCarriers(parsed.quotes, carriersCatalog), currency: parsed.currency };
  };

  // Pass 1: quote with the unit price.
  const first = await quoteWith(unitPrice);
  if (!first) return neutral(MSG.unavailable);
  if (first.currency !== CURRENCY) return neutral(MSG.notAvailableCountry);
  if (first.ranked.length === 0) return json({ sin_cobertura: true });

  // Pass 2: shipping depends on the collected value → re-quote with the provisional unit price.
  const provisional = provisionalTotal(subtotal, first.ranked[0]!.cost, quantity);
  const second = await quoteWith(provisional / quantity);
  const secondOk = second !== null && second.currency === CURRENCY && second.ranked.length > 0;
  const totals = twoPassTotal({
    subtotal,
    quantity,
    firstShipping: first.ranked[0]!.cost,
    secondShipping: secondOk ? second.ranked[0]!.cost : null,
  });
  const carriers: CarrierOption[] = secondOk
    ? second.ranked
    : first.ranked.map((c) => ({ ...c, cost: c.cost * 1.05 }));

  if (!hasPositiveMargin({ total: totals.total, shipping: totals.quotedShipping, supplierCost, quantity })) {
    deps.log.error(`[dropi-sales] quote refused: non-positive margin (product ${product.id}, conversation ${ctx.scopeId})`);
    return neutral(MSG.quoteRejected);
  }

  const quoteId = deps.randomId();
  const stored: StoredQuote = {
    scope: ctx.scopeId,
    agentId: ctx.agentId,
    product: { id: product.id, name: product.name, type: product.type, variationId, option, supplierCost },
    quantity,
    unitPrice,
    subtotal,
    shipping: totals.shownShipping,
    total: totals.total,
    chargedUnitPrice: totals.chargedUnitPrice,
    city: { id: city.id, name: city.name, departmentId: city.departmentId, departmentName },
    carriers,
    currency: CURRENCY,
  };
  await deps.kv.set(keys.quote(ctx.scopeId, quoteId), json(stored), TTL.quote);
  if (totals.usedFallback) deps.log.warn(`[dropi-sales] second quote failed; 5 % shipping margin used (conversation ${ctx.scopeId})`);

  return json({
    cotizacion_id: quoteId,
    producto: product.name,
    ...(option ? { opcion: option } : {}),
    cantidad: quantity,
    precio_unitario: unitPrice,
    subtotal,
    envio: totals.shownShipping,
    total: totals.total,
    moneda: CURRENCY,
    ciudad: city.name,
    departamento: departmentName,
    pago: PAYMENT,
  });
}

// ── C.5 dropi_preparar_pedido ────────────────────────────────────────────────

export async function prepareOrder(
  ctx: DropiSalesContext,
  deps: DropiSalesDeps,
  input: {
    cotizacion_id: string;
    nombre: string;
    apellido: string;
    direccion: string;
    telefono: string;
    barrio: string | null;
    notas: string | null;
  }
): Promise<string> {
  // A quote that already produced an order (or ended in 'desconocido') is deleted: one quote, one order.
  const quote = parseStored<StoredQuote>(await deps.kv.get(keys.quote(ctx.scopeId, input.cotizacion_id)).catch(() => null), ctx);
  if (!quote) return neutral(MSG.quoteNotFound);

  // One live pending order per scope: preparing again replaces (and invalidates) the previous one.
  const previousToken = await deps.kv.get(keys.pendingCurrent(ctx.scopeId)).catch(() => null);
  const token = deps.randomId();
  const pending: StoredPending = {
    scope: ctx.scopeId,
    agentId: ctx.agentId,
    quoteId: input.cotizacion_id,
    quote,
    buyer: {
      name: input.nombre,
      surname: input.apellido,
      address: input.direccion,
      phone: input.telefono,
      neighborhood: input.barrio,
      notes: input.notas,
    },
    markerTurn: ctx.currentUserTurn,
    pendingCreatedAt: deps.now().getTime(),
    summaryDeliveredAt: null,
  };
  await deps.kv.set(keys.pending(ctx.scopeId, token), json(pending), TTL.pending);
  await deps.kv.set(keys.pendingCurrent(ctx.scopeId), token, TTL.pending);
  if (previousToken && previousToken !== token) {
    await deps.kv.del(keys.pending(ctx.scopeId, previousToken)).catch(() => {});
  }
  ctx.turn.preparedToken = token;

  return json({
    pedido_token: token,
    resumen: {
      producto: quote.product.name,
      ...(quote.product.option ? { opcion: quote.product.option } : {}),
      cantidad: quote.quantity,
      total: quote.total,
      moneda: quote.currency,
      ciudad: `${quote.city.name}, ${quote.city.departmentName}`,
      direccion: input.barrio ? `${input.direccion}, ${input.barrio}` : input.direccion,
      nombre: `${input.nombre} ${input.apellido}`,
      telefono: input.telefono,
      pago: PAYMENT,
    },
    instruccion: MSG.confirmInstruction,
  });
}

/**
 * Called by the worker / preview AFTER the turn's assistant message is saved (and before it is sent
 * to the channel): stamps the pending prepared in this turn with the time its summary was
 * delivered. dropi_confirmar_pedido requires a buyer message received after that instant.
 */
export async function markSummaryDelivered(ctx: DropiSalesContext, deps: DropiSalesDeps): Promise<void> {
  const token = ctx.turn.preparedToken;
  if (!token) return;
  const key = keys.pending(ctx.scopeId, token);
  const pending = parseStored<StoredPending>(await deps.kv.get(key).catch(() => null), ctx);
  if (!pending || pending.summaryDeliveredAt !== null) return;
  if ((await deps.kv.get(keys.pendingCurrent(ctx.scopeId)).catch(() => null)) !== token) return;
  pending.summaryDeliveredAt = deps.now().getTime();
  await deps.kv.set(key, json(pending), TTL.pending).catch((err: Error) =>
    deps.log.warn(`[dropi-sales] could not stamp summary delivery (conversation ${ctx.scopeId}): ${err.name}`)
  );
}

async function noticeCap(ctx: DropiSalesContext, deps: DropiSalesDeps, reason: CapNotice['reason']): Promise<void> {
  deps.log.warn(`[dropi-sales] order cap reached: ${reason} (agent ${ctx.agentId}, org ${ctx.organizationId}, conversation ${ctx.scopeId})`);
  // At most one dashboard notification per agent and reason per hour.
  const first = await deps.kv.setNx(keys.capNotice(ctx.agentId, reason), '1', TTL.capNotice).catch(() => false);
  if (!first) return;
  await deps
    .notifyCapReached({ organizationId: ctx.organizationId, agentId: ctx.agentId, reason })
    .catch((err: Error) => deps.log.warn(`[dropi-sales] cap notification failed (agent ${ctx.agentId}): ${err.name}`));
}

// ── C.5 dropi_confirmar_pedido ───────────────────────────────────────────────

export async function confirmOrder(
  ctx: DropiSalesContext,
  deps: DropiSalesDeps,
  input: { pedido_token: string }
): Promise<string> {
  const token = input.pedido_token;
  const confirmedKey = keys.confirmed(ctx.scopeId, token);
  const previous = async (): Promise<string | null> => {
    const raw = await deps.kv.get(confirmedKey).catch(() => null);
    const rec = parseStored<{ scope: string; agentId: string; output: string }>(raw, ctx);
    return rec?.output ?? null;
  };

  const pending = parseStored<StoredPending>(await deps.kv.get(keys.pending(ctx.scopeId, token)).catch(() => null), ctx);
  if (!pending) return (await previous()) ?? neutral(MSG.pendingNotFound);
  const current = await deps.kv.get(keys.pendingCurrent(ctx.scopeId)).catch(() => null);
  if (current !== token) return neutral(MSG.pendingReplaced);

  // Acceptance: a new user turn, received after the summary turn finished, saying yes (and not no).
  if (
    !buyerRepliedSince(pending.markerTurn, ctx.currentUserTurn) ||
    !receivedAfterSummary(ctx.currentMessageReceivedAt, pending.summaryDeliveredAt) ||
    !isAffirmative(ctx.lastBuyerMessage)
  ) {
    return json({ requiere_confirmacion: true, mensaje: MSG.needsConfirmation });
  }

  const locked = await deps.kv.setNx(keys.confirmLock(ctx.scopeId, token), '1', TTL.confirmLock).catch(() => false);
  if (!locked) return (await previous()) ?? neutral(MSG.processing);

  const { quote, buyer } = pending;
  const finish = async (output: string, opts: { consumeQuote: boolean } = { consumeQuote: false }): Promise<string> => {
    await deps.kv.set(confirmedKey, json({ scope: ctx.scopeId, agentId: ctx.agentId, output }), TTL.confirmed).catch(() => {});
    await deps.kv.del(keys.pending(ctx.scopeId, token)).catch(() => {});
    if ((await deps.kv.get(keys.pendingCurrent(ctx.scopeId)).catch(() => null)) === token) {
      await deps.kv.del(keys.pendingCurrent(ctx.scopeId)).catch(() => {});
    }
    // One quote, one order: once it produced an order (or may have), it cannot be prepared again.
    if (opts.consumeQuote) await deps.kv.del(keys.quote(ctx.scopeId, pending.quoteId)).catch(() => {});
    return output;
  };
  const releaseAndFail = async (orderRowId: string | null): Promise<string> => {
    if (orderRowId) await deps.orders.deletePending(orderRowId, ctx.agentId).catch(() => {});
    await deps.kv.del(keys.confirmLock(ctx.scopeId, token)).catch(() => {});
    return neutral(MSG.orderFailed);
  };

  const orderRowId = deps.randomId();
  const who = identityOf(ctx);
  const limits: OrderLimits = {
    perConversation: LIMITS.ordersPerConversation,
    perPhone: LIMITS.ordersPerPhone,
    perAgent: await maxDailyOrdersOf(ctx, deps),
  };
  let admitted: InsertWithinLimitsOutcome;
  try {
    admitted = await deps.orders.insertPendingWithinLimits({
      id: orderRowId,
      organizationId: ctx.organizationId,
      agentId: ctx.agentId,
      conversationId: ctx.conversationId,
      previewSessionId: who.previewSessionId,
      contactId: ctx.contactId,
      total: quote.total,
      currency: quote.currency,
      items: [
        {
          producto_id: quote.product.id,
          opcion_id: quote.product.variationId,
          nombre: quote.product.name,
          opcion: quote.product.option,
          cantidad: quote.quantity,
          precio_unitario: quote.chargedUnitPrice,
        },
      ],
      cityName: quote.city.name,
      buyerPhoneLast10: buyer.phone,
      ownerWaLast10: who.waLast10,
    }, limits);
  } catch (err) {
    deps.log.error(`[dropi-sales] could not register order (conversation ${ctx.scopeId}): ${(err as Error).name}`);
    return releaseAndFail(null);
  }
  if (!admitted.ok) {
    if (admitted.reason === 'verifying') {
      deps.log.warn(`[dropi-sales] order refused: previous order under verification (agent ${ctx.agentId}, conversation ${ctx.scopeId})`);
      return finish(json({ pedido_creado: false, en_verificacion: true, mensaje: MSG.previousVerifying, ofrecer_asesor: true }));
    }
    await noticeCap(ctx, deps, admitted.reason);
    return finish(json({ pedido_creado: false, mensaje: MSG.orderCapReached, ofrecer_asesor: true }));
  }

  let attempts = 0;
  for (const carrier of quote.carriers) {
    if (attempts >= LIMITS.maxCarrierAttempts) break;
    if (!hasPositiveMargin({ total: quote.total, shipping: carrier.cost, supplierCost: quote.product.supplierCost, quantity: quote.quantity })) {
      continue; // a more expensive carrier would make the order lose money
    }
    attempts += 1;
    let result: McpCallResult;
    try {
      result = await ctx.call('create_order', {
        name: buyer.name,
        surname: buyer.surname,
        dir: buyer.address,
        state: quote.city.departmentName,
        city: quote.city.name,
        phone: buyer.phone,
        rate_type: 'CON RECAUDO',
        ...(buyer.neighborhood ? { colonia: buyer.neighborhood } : {}),
        ...(buyer.notes ? { notes: buyer.notes } : {}),
        shop_order_id: orderRowId,
        distribution_company_id: carrier.id,
        products: [
          {
            id: quote.product.id,
            price: quote.chargedUnitPrice,
            quantity: quote.quantity,
            ...(quote.product.variationId !== null ? { variation_id: quote.product.variationId } : {}),
          },
        ],
      });
    } catch {
      result = { content: '', isError: true }; // classified as unknown below: never retried
    }

    const outcome = classifyCreateOrderResult(result, ctx.unavailableMessage);
    if (outcome.kind === 'created') {
      await deps.orders
        .markCreated({ id: orderRowId, agentId: ctx.agentId, externalOrderId: outcome.orderId, status: outcome.status, carrierId: carrier.id })
        .catch((err: Error) => deps.log.error(`[dropi-sales] order ${outcome.orderId} created but not recorded (row ${orderRowId}): ${err.message}`));
      if (outcome.total !== null && outcome.total !== quote.total) {
        deps.log.warn(`[dropi-sales] order ${outcome.orderId} total differs from the quote (row ${orderRowId})`);
      }
      deps.log.info(`[dropi-sales] order ${outcome.orderId} created (row ${orderRowId}, carrier ${carrier.id}, conversation ${ctx.scopeId})`);
      return finish(
        json({ pedido_creado: true, numero_pedido: outcome.orderId, total: quote.total, moneda: quote.currency, pago: PAYMENT }),
        { consumeQuote: true }
      );
    }
    if (outcome.kind === 'carrier_rejected') {
      deps.log.warn(`[dropi-sales] carrier ${carrier.id} rejected order row ${orderRowId}; trying next`);
      continue;
    }
    if (outcome.kind === 'unknown') {
      await deps.orders.markUnknown({ id: orderRowId, agentId: ctx.agentId, carrierId: carrier.id }).catch(() => {});
      deps.log.error(`[dropi-sales] create_order outcome unknown — MANUAL REVIEW (row ${orderRowId}, carrier ${carrier.id}, conversation ${ctx.scopeId})`);
      return finish(json({ pedido_creado: false, en_verificacion: true, mensaje: MSG.orderVerifying, ofrecer_asesor: true }), { consumeQuote: true });
    }
    if (outcome.kind === 'no_margin') {
      deps.log.error(`[dropi-sales] Dropi refused order row ${orderRowId}: non-positive profit (product ${quote.product.id})`);
    } else {
      deps.log.warn(`[dropi-sales] Dropi rejected order row ${orderRowId} (carrier ${carrier.id})`);
    }
    return releaseAndFail(orderRowId);
  }
  deps.log.warn(`[dropi-sales] no carrier accepted order row ${orderRowId} after ${attempts} attempt(s)`);
  return releaseAndFail(orderRowId);
}

// ── C.6 dropi_estado_pedido ──────────────────────────────────────────────────

async function fetchOrder(ctx: DropiSalesContext, deps: DropiSalesDeps, orderNumber: string): Promise<ParsedOrder | null> {
  const content = await callContent(ctx, deps, 'get_order', { id: orderNumber });
  if (content === null) return null;
  const order = parseGetOrder(content);
  return order && order.orderId === orderNumber ? order : null;
}

async function carrierOf(ctx: DropiSalesContext, deps: DropiSalesDeps, order: ParsedOrder): Promise<string | null> {
  const from = datePart(order.createdAt);
  if (!from) return null;
  const content = await callContent(ctx, deps, 'list_orders', {
    text_to_search: order.orderId,
    from,
    until: isoDatePlusDays(deps.now(), 1),
    result_number: 5,
  });
  return content === null ? null : findShippingCompany(content, order.orderId);
}

async function freshOrder(
  ctx: DropiSalesContext,
  deps: DropiSalesDeps,
  order: ParsedOrder,
  opts: { own: boolean }
): Promise<OrderForLlm> {
  const carrier = await carrierOf(ctx, deps, order).catch(() => null);
  if (order.status) {
    await deps.orders
      .updateStatusCached({ agentId: ctx.agentId, organizationId: ctx.organizationId, externalOrderId: order.orderId, status: order.status })
      .catch(() => {});
  }
  return presentOrder(order, carrier, { includeTracking: opts.own });
}

function localOrder(row: DropiOrderRecord): OrderForLlm {
  return {
    numero_pedido: row.externalOrderId,
    estado: row.statusLocal === 'desconocido' ? 'EN VERIFICACIÓN' : cleanText(row.statusCached ?? 'PENDIENTE', 40),
    fecha: row.createdAt,
    productos: row.items.map((i) => ({ nombre: cleanText(i.nombre), cantidad: i.cantidad })),
    total: row.total,
    moneda: row.currency,
  };
}

export async function orderStatus(
  ctx: DropiSalesContext,
  deps: DropiSalesDeps,
  input: { numero_pedido: string | null; telefono: string | null }
): Promise<string> {
  const who = identityOf(ctx);

  if (input.numero_pedido === null) {
    const rows = await deps.orders.findOwnRecent(who, 3).catch(() => []);
    if (rows.length === 0) return json({ pedidos: [], mensaje: MSG.noOwnOrders });
    const pedidos: OrderForLlm[] = [];
    for (const row of rows) {
      const fresh = row.externalOrderId ? await fetchOrder(ctx, deps, row.externalOrderId) : null;
      pedidos.push(fresh ? await freshOrder(ctx, deps, fresh, { own: true }) : localOrder(row));
    }
    return json({ pedidos });
  }

  const orderNumber = input.numero_pedido;
  const perOrder = await deps.kv.incrWithTtl(keys.lookupRate(ctx.scopeId, orderNumber), TTL.rateWindow).catch(() => 0);
  const overall = await deps.kv.incrWithTtl(keys.lookupRateAll(ctx.scopeId), TTL.rateWindow).catch(() => 0);
  if (perOrder > LIMITS.lookupsPerOrderPerHour || overall > LIMITS.lookupsPerHour) {
    deps.log.warn(`[dropi-sales] order lookup rate limit hit (conversation ${ctx.scopeId})`);
    return neutral(MSG.lookupRateLimited);
  }

  const own = await deps.orders.findOwnByNumber(who, orderNumber).catch(() => null);
  if (own) {
    const fresh = await fetchOrder(ctx, deps, orderNumber);
    return json({ pedidos: [fresh ? await freshOrder(ctx, deps, fresh, { own: true }) : localOrder(own)] });
  }

  // Not an own order: verify by phone. WhatsApp with wa_from: the Meta sender number (any phone in
  // the arguments is ignored). Otherwise: the phone given by the buyer.
  const expected = who.waLast10 ?? input.telefono;
  if (expected === null) return neutral(MSG.phoneRequired);

  // Per-agent limits (new sessions do not reset them): overall and per target phone.
  const perAgent = await deps.kv.incrWithTtl(keys.lookupRateAgent(ctx.agentId), TTL.rateWindow).catch(() => 0);
  const perPhone = await deps.kv.incrWithTtl(keys.lookupRateAgentPhone(ctx.agentId, expected), TTL.rateWindow).catch(() => 0);
  if (perAgent > LIMITS.lookupsPerAgentPerHour || perPhone > LIMITS.lookupsPerAgentPhonePerHour) {
    deps.log.warn(`[dropi-sales] verified order lookup agent limit hit (agent ${ctx.agentId}, conversation ${ctx.scopeId})`);
    return neutral(MSG.lookupRateLimited);
  }

  const order = await fetchOrder(ctx, deps, orderNumber);
  if (!order || order.phoneLast10 === null || order.phoneLast10 !== expected) {
    deps.log.info(`[dropi-sales] order lookup not verified (conversation ${ctx.scopeId})`);
    return neutral(MSG.orderNotFound);
  }
  // Verified but not own: no tracking code (guia).
  return json({ pedidos: [await freshOrder(ctx, deps, order, { own: false })] });
}

// ── Real dependencies ────────────────────────────────────────────────────────

interface OrderDbRow {
  id: string;
  external_order_id: string | null;
  status_local: 'creada' | 'desconocido';
  status_cached: string | null;
  total: string;
  currency: string;
  items: unknown;
  created_at: Date | string;
}

function toRecord(r: OrderDbRow): DropiOrderRecord {
  return {
    id: r.id,
    externalOrderId: r.external_order_id,
    statusLocal: r.status_local,
    statusCached: r.status_cached,
    total: Number(r.total),
    currency: r.currency,
    items: Array.isArray(r.items) ? (r.items as StoredOrderItem[]) : [],
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  };
}

const ORDER_COLUMNS = 'id, external_order_id, status_local, status_cached, total, currency, items, created_at';
/**
 * Mirrors core.ownsOrder ($1 agent, $2 org, $3 waLast10, $4 conversation, $5 preview session):
 * WhatsApp with wa_from → owner_wa_last10 or buyer_phone_last10; else the same conversation;
 * else (preview) the same preview session. Never contact_id. Rows with a NULL agent never match.
 */
const OWNER_WHERE = `agent_id = $1 AND organization_id = $2 AND (
    ($3::text IS NOT NULL AND (owner_wa_last10 = $3::text OR buyer_phone_last10 = $3::text))
    OR ($3::text IS NULL AND $4::uuid IS NOT NULL AND conversation_id = $4::uuid)
    OR ($3::text IS NULL AND $4::uuid IS NULL AND $5::text IS NOT NULL AND preview_session_id = $5::text)
  )`;
const ownerParams = (o: BuyerIdentity): unknown[] => [o.agentId, o.organizationId, o.waLast10, o.conversationId, o.previewSessionId];

export function createRealDeps(): DropiSalesDeps {
  return {
    kv: {
      async get(key) {
        const { redis } = await import('../../config/redis');
        return redis.get(key);
      },
      async set(key, value, ttl) {
        const { redis } = await import('../../config/redis');
        await redis.set(key, value, 'EX', ttl);
      },
      async setNx(key, value, ttl) {
        const { redis } = await import('../../config/redis');
        return (await redis.set(key, value, 'EX', ttl, 'NX')) === 'OK';
      },
      async del(key) {
        const { redis } = await import('../../config/redis');
        await redis.del(key);
      },
      async incrWithTtl(key, ttl) {
        const { redis } = await import('../../config/redis');
        // INCR is atomic; the TTL is (re)applied whenever the key has none, so a lost EXPIRE can
        // never leave a counter that blocks forever (works on any Redis version, no EXPIRE NX).
        const res = await redis.multi().incr(key).ttl(key).exec();
        const n = Number(res?.[0]?.[1]);
        if (!Number.isFinite(n)) throw new Error('INCR failed');
        if (Number(res?.[1]?.[1]) < 0) await redis.expire(key, ttl);
        return n;
      },
      async hget(key, field) {
        const { redis } = await import('../../config/redis');
        return redis.hget(key, field);
      },
      async hsetWithTtl(key, entries, ttl) {
        if (Object.keys(entries).length === 0) return;
        const { redis } = await import('../../config/redis');
        await redis.multi().hset(key, entries).expire(key, ttl).exec();
      },
    },
    orders: {
      async insertPendingWithinLimits(row, limits) {
        const { getClient } = await import('../../config/database');
        const client = await getClient();
        try {
          await client.query('BEGIN');
          // Per-agent lock for count + insert (released at COMMIT/ROLLBACK): no count-then-insert race.
          await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`dropi_orders:${row.agentId}`]);
          const r = await client.query<{ conv_unknown: number; conv: number; phone: number; agent: number }>(
            `SELECT
               COUNT(*) FILTER (WHERE in_scope AND status_local = 'desconocido')::int AS conv_unknown,
               COUNT(*) FILTER (WHERE in_scope)::int AS conv,
               COUNT(*) FILTER (WHERE buyer_phone_last10 = $5::text)::int AS phone,
               COUNT(*)::int AS agent
             FROM (
               SELECT status_local, buyer_phone_last10,
                      (($3::uuid IS NOT NULL AND conversation_id = $3::uuid)
                        OR ($3::uuid IS NULL AND $4::text IS NOT NULL AND preview_session_id = $4::text)) AS in_scope
                 FROM dropi_orders
                WHERE agent_id = $1 AND organization_id = $2 AND created_at > NOW() - INTERVAL '24 hours'
             ) t`,
            [row.agentId, row.organizationId, row.conversationId, row.previewSessionId, row.buyerPhoneLast10]
          );
          const c = r.rows[0];
          const refusal = orderCapDecision(
            { conversationUnknown: c?.conv_unknown ?? 0, conversation: c?.conv ?? 0, phone: c?.phone ?? 0, agent: c?.agent ?? 0 },
            limits
          );
          if (refusal) {
            await client.query('ROLLBACK');
            return { ok: false, reason: refusal };
          }
          await client.query(
            `INSERT INTO dropi_orders
               (id, organization_id, agent_id, conversation_id, preview_session_id, contact_id, status_local, total,
                currency, items, city_name, buyer_phone_last10, owner_wa_last10)
             VALUES ($1, $2, $3, $4, $5, $6, 'desconocido', $7, $8, $9::jsonb, $10, $11, $12)`,
            [row.id, row.organizationId, row.agentId, row.conversationId, row.previewSessionId, row.contactId, row.total,
              row.currency, JSON.stringify(row.items), row.cityName, row.buyerPhoneLast10, row.ownerWaLast10]
          );
          await client.query('COMMIT');
          return { ok: true };
        } catch (err) {
          await client.query('ROLLBACK').catch(() => {});
          throw err;
        } finally {
          client.release();
        }
      },
      async markCreated({ id, agentId, externalOrderId, status, carrierId }) {
        const { query } = await import('../../config/database');
        await query(
          `UPDATE dropi_orders
              SET external_order_id = $3, status_local = 'creada', status_cached = $4, carrier_id = $5, updated_at = NOW()
            WHERE id = $1 AND agent_id = $2`,
          [id, agentId, externalOrderId, status, carrierId]
        );
      },
      async markUnknown({ id, agentId, carrierId }) {
        const { query } = await import('../../config/database');
        await query(
          `UPDATE dropi_orders SET carrier_id = $3, updated_at = NOW() WHERE id = $1 AND agent_id = $2`,
          [id, agentId, carrierId]
        );
      },
      async deletePending(id, agentId) {
        const { query } = await import('../../config/database');
        await query(
          `DELETE FROM dropi_orders WHERE id = $1 AND agent_id = $2 AND external_order_id IS NULL`,
          [id, agentId]
        );
      },
      async findOwnRecent(owner, limit) {
        const { query } = await import('../../config/database');
        const r = await query<OrderDbRow>(
          `SELECT ${ORDER_COLUMNS} FROM dropi_orders WHERE ${OWNER_WHERE} ORDER BY created_at DESC LIMIT $6`,
          [...ownerParams(owner), limit]
        );
        return r.rows.map(toRecord);
      },
      async findOwnByNumber(owner, externalOrderId) {
        const { query } = await import('../../config/database');
        const r = await query<OrderDbRow>(
          `SELECT ${ORDER_COLUMNS} FROM dropi_orders WHERE ${OWNER_WHERE} AND external_order_id = $6 LIMIT 1`,
          [...ownerParams(owner), externalOrderId]
        );
        return r.rows[0] ? toRecord(r.rows[0]) : null;
      },
      async updateStatusCached({ agentId, organizationId, externalOrderId, status }) {
        const { query } = await import('../../config/database');
        await query(
          `UPDATE dropi_orders SET status_cached = $4, updated_at = NOW()
            WHERE agent_id = $1 AND organization_id = $2 AND external_order_id = $3`,
          [agentId, organizationId, externalOrderId, status]
        );
      },
    },
    async loadConfigValue(agentId, key) {
      const { loadAgentConfigContext } = await import('../agent-config.service');
      const ctx = await loadAgentConfigContext(agentId);
      const value = ctx.values[key];
      if (value !== undefined && value !== null && value !== '') return value;
      return ctx.schema.find((s) => s.key === key)?.default;
    },
    async notifyCapReached({ organizationId, agentId, reason }) {
      const { createNotification } = await import('../notification.service');
      const what =
        reason === 'agent_cap'
          ? 'el agente alcanzó su máximo de pedidos diarios (max_pedidos_diarios)'
          : reason === 'phone_cap'
            ? 'un mismo teléfono alcanzó el máximo de 2 pedidos en 24 h'
            : 'una conversación alcanzó el máximo de 2 pedidos en 24 h';
      await createNotification({
        organizationId,
        type: 'dropi_order_cap',
        title: 'Pedidos de Dropi en pausa',
        message: `No se creó un pedido contra entrega porque ${what}. Revisa la conversación y contacta al cliente.`,
        data: { agentId, reason },
        sendEmail: false,
      });
    },
    log: {
      info: (m) => console.log(m),
      warn: (m) => console.warn(m),
      error: (m) => console.error(m),
    },
    randomId: () => randomUUID(),
    now: () => new Date(),
  };
}
