/**
 * Dropi sales toolkit — pure functions (no DB, Redis or network).
 *
 * Everything that comes from Dropi is DATA, never instructions: texts are stripped of control
 * characters and truncated, JSON is parsed defensively, and the shapes sent to the LLM are built
 * field by field (whitelists), so supplier costs (sale_price, simple_price), suggested_price,
 * supplier_id, sku, exact stock and any `customer` object can never leak by accident.
 */

// ── Text ─────────────────────────────────────────────────────────────────────

// Control, zero-width, line/paragraph separators and bidi overrides (built from code points).
const CONTROL_RANGES: Array<[number, number]> = [
  [0x00, 0x1f], [0x7f, 0x9f], // C0 / C1 controls
  [0x200b, 0x200f], [0x2028, 0x202e], [0x2060, 0x2069], [0xfeff, 0xfeff], // zero-width, separators, bidi
];
const hex4 = (n: number): string => '\\' + 'u' + n.toString(16).padStart(4, '0');
const CONTROL_CLASS = '[' + CONTROL_RANGES.map(([a, b]) => `${hex4(a)}-${hex4(b)}`).join('') + ']';
const CONTROL_CHARS = new RegExp(CONTROL_CLASS, 'g');
const HAS_CONTROL_CHAR = new RegExp(CONTROL_CHARS.source);

export const MAX_TEXT_LENGTH = 120;

/** Removes control, zero-width and bidi characters. */
export function stripControl(value: string): string {
  return value.replace(CONTROL_CHARS, ' ');
}

/** Provider text → safe display text: no control chars, collapsed spaces, truncated. */
export function cleanText(value: unknown, max = MAX_TEXT_LENGTH): string {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return stripControl(String(value)).replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Buyer input text (name, address…): same as cleanText with an explicit bound. */
export function cleanInput(value: unknown, max: number): string {
  return cleanText(value, max);
}

/** Search normalization: NFD without diacritics, collapsed spaces, trim. Case is preserved. */
export function normalizeForSearch(value: string): string {
  return stripControl(value)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Comparison key: normalized for search + upper case ("Cajicá" → "CAJICA"). */
export function normalizeKey(value: string): string {
  return normalizeForSearch(value).toUpperCase();
}

/** Buyer phone → 10 national digits (drops a leading 57 when 12 digits remain), or null. */
export function normalizePhone(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  let digits = String(value).replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('57')) digits = digits.slice(2);
  return digits.length === 10 ? digits : null;
}

/** Last 10 digits of a stored phone (wa_from, Dropi customer.phone), or null. */
export function last10Digits(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const digits = String(value).replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : null;
}

/** Order number given by the buyer: digits only, 1–12, or null. */
export function parseOrderNumber(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const s = String(value).trim().replace(/^#/, '');
  return /^\d{1,12}$/.test(s) ? s : null;
}

// ── Defensive JSON helpers ───────────────────────────────────────────────────

export function safeParseJson(content: unknown): unknown {
  if (typeof content !== 'string') return undefined;
  try {
    return JSON.parse(content) as unknown;
  } catch {
    return undefined;
  }
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Finite number from a number or a numeric string, else null. */
export function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '' && /^-?\d+(\.\d+)?$/.test(value.trim())) {
    const n = Number(value.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Positive integer id from a number or digit string, else null. */
export function toId(value: unknown): number | null {
  const n = toNumber(value);
  return n !== null && Number.isInteger(n) && n > 0 ? n : null;
}

function itemsOf(parsed: unknown): unknown[] | null {
  if (Array.isArray(parsed)) return parsed;
  const rec = asRecord(parsed);
  if (rec && Array.isArray(rec['items'])) return rec['items'] as unknown[];
  return null;
}

/** http(s) URL, bounded length, else null (images are data too). */
function safeUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (v.length > 500 || HAS_CONTROL_CHAR.test(v)) return null;
  return /^https?:\/\/[^\s]+$/i.test(v) ? v : null;
}

// ── Pricing ──────────────────────────────────────────────────────────────────

export const DEFAULT_MARGIN_PERCENT = 20;
export const MIN_MARGIN_PERCENT = 0;
export const MAX_MARGIN_PERCENT = 300;
/** Platform commission used in the margin check (observed ≈3.14 %; 3.5 % for headroom). */
export const PLATFORM_FEE_RATE = 0.035;
/** Safety margin over the first shipping quote when the second quote fails. */
export const SHIPPING_FALLBACK_FACTOR = 1.05;

/**
 * Number typed by a person in the agent configuration: tolerates spaces, a trailing "%" and a
 * decimal comma ("20%", " 20,5 ", "1 000") before the strict toNumber check. Null when invalid.
 */
export function parseLooseNumber(raw: unknown): number | null {
  if (typeof raw !== 'string') return toNumber(raw);
  let s = raw.replace(/\s+/g, '').replace(/%$/, '');
  if (/^-?\d+,\d+$/.test(s)) s = s.replace(',', '.');
  return toNumber(s);
}

/** porcentaje_margen → number in [0, 300]; 20 when missing or invalid. */
export function resolveMarginPercent(raw: unknown): number {
  const n = parseLooseNumber(raw);
  if (n === null) return DEFAULT_MARGIN_PERCENT;
  return Math.min(MAX_MARGIN_PERCENT, Math.max(MIN_MARGIN_PERCENT, n));
}

export const DEFAULT_MAX_DAILY_ORDERS = 50;
export const MIN_MAX_DAILY_ORDERS = 1;
export const MAX_MAX_DAILY_ORDERS = 1000;

/** max_pedidos_diarios → integer in [1, 1000]; 50 when missing or invalid. */
export function resolveMaxDailyOrders(raw: unknown): number {
  const n = parseLooseNumber(raw);
  if (n === null) return DEFAULT_MAX_DAILY_ORDERS;
  return Math.min(MAX_MAX_DAILY_ORDERS, Math.max(MIN_MAX_DAILY_ORDERS, Math.floor(n)));
}

/** Smallest multiple of `step` ≥ value (tolerant to float noise). */
export function ceilToMultiple(value: number, step: number): number {
  return Math.ceil((value - 1e-6) / step) * step;
}

/** Price for the buyer = ceil to 100 of suggested × (1 + margin/100); null when not sellable. */
export function productPrice(suggestedPrice: number | null, marginPercent: number): number | null {
  if (suggestedPrice === null || !Number.isFinite(suggestedPrice) || suggestedPrice <= 0) return null;
  // Integer arithmetic in hundredths: suggested × (100 + margin) is the price × 100.
  const hundredths = Math.round(suggestedPrice * (100 + marginPercent));
  return Math.ceil(hundredths / 10000 - 1e-9) * 100;
}

export interface TwoPassTotal {
  /** What the buyer pays on delivery; a multiple of 100 × quantity. */
  total: number;
  /** total − subtotal (the shipping shown to the buyer). */
  shownShipping: number;
  /** Shipping used for the margin check (second quote, or first × 1.05). */
  quotedShipping: number;
  /** Unit price sent to Dropi (total / quantity): integer, multiple of 100. */
  chargedUnitPrice: number;
  usedFallback: boolean;
}

/** Provisional total of pass 1: the multiple of 100 × quantity ≥ subtotal + shipping. */
export function provisionalTotal(subtotal: number, shipping: number, quantity: number): number {
  return ceilToMultiple(subtotal + shipping, 100 * quantity);
}

/**
 * Two-pass total. Shipping depends on the collected value, so pass 2 re-quotes with
 * price = provisional / quantity. If pass 2 raises the total, that is the final one; if pass 2
 * failed (null), the first shipping plus a 5 % safety margin is used.
 */
export function twoPassTotal(input: {
  subtotal: number;
  quantity: number;
  firstShipping: number;
  secondShipping: number | null;
}): TwoPassTotal {
  const { subtotal, quantity, firstShipping, secondShipping } = input;
  const provisional = provisionalTotal(subtotal, firstShipping, quantity);
  let total: number;
  let quotedShipping: number;
  let usedFallback = false;
  if (secondShipping !== null) {
    total = Math.max(provisional, provisionalTotal(subtotal, secondShipping, quantity));
    quotedShipping = secondShipping;
  } else {
    quotedShipping = firstShipping * SHIPPING_FALLBACK_FACTOR;
    total = provisionalTotal(subtotal, quotedShipping, quantity);
    usedFallback = true;
  }
  return {
    total,
    shownShipping: total - subtotal,
    quotedShipping,
    chargedUnitPrice: total / quantity,
    usedFallback,
  };
}

/** Estimated profit = total − shipping − supplier cost × qty − total × 3.5 %. */
export function estimatedProfit(input: {
  total: number;
  shipping: number;
  supplierCost: number;
  quantity: number;
}): number {
  return input.total - input.shipping - input.supplierCost * input.quantity - input.total * PLATFORM_FEE_RATE;
}

export function hasPositiveMargin(input: Parameters<typeof estimatedProfit>[0]): boolean {
  return estimatedProfit(input) > 0;
}

// ── Products ─────────────────────────────────────────────────────────────────

export interface DropiAttribute {
  name: string;
  value: string;
}

export interface DropiVariation {
  id: number;
  stock: number;
  /** Supplier cost: server only. */
  salePrice: number | null;
  suggestedPrice: number | null;
  attributes: DropiAttribute[];
}

/** Normalized product (cached server side, costs included; never sent to the LLM as is). */
export interface DropiProduct {
  id: number;
  name: string;
  type: 'SIMPLE' | 'VARIABLE';
  stock: number;
  /** Supplier cost: server only. */
  salePrice: number | null;
  suggestedPrice: number | null;
  image: string | null;
  variations: DropiVariation[];
}

function normalizeVariation(raw: unknown): DropiVariation | null {
  const rec = asRecord(raw);
  if (!rec) return null;
  const id = toId(rec['id']);
  if (id === null) return null; // `[{}]` and friends mean "no variations"
  const attributes: DropiAttribute[] = [];
  if (Array.isArray(rec['attributes'])) {
    for (const a of rec['attributes'] as unknown[]) {
      const ar = asRecord(a);
      if (!ar) continue;
      const name = cleanText(ar['name'], 40).toUpperCase();
      const value = cleanText(ar['value'], 60);
      if (name && value) attributes.push({ name, value });
    }
  }
  return {
    id,
    stock: Math.max(0, Math.floor(toNumber(rec['stock']) ?? 0)),
    salePrice: toNumber(rec['sale_price']),
    suggestedPrice: toNumber(rec['suggested_price']),
    attributes,
  };
}

function firstImage(gallery: unknown): string | null {
  if (!Array.isArray(gallery)) return null;
  for (const g of gallery as unknown[]) {
    const rec = asRecord(g);
    if (!rec) continue;
    const url = safeUrl(rec['urlS3']) ?? safeUrl(rec['url']);
    if (url) return url;
  }
  return null;
}

export function normalizeProduct(raw: unknown): DropiProduct | null {
  const rec = asRecord(raw);
  if (!rec) return null;
  const id = toId(rec['id']);
  const name = cleanText(rec['name']);
  if (id === null || !name) return null;
  const rawVariations = Array.isArray(rec['variations'])
    ? (rec['variations'] as unknown[])
    : rec['variations'] !== undefined && rec['variations'] !== null
      ? [rec['variations']]
      : [];
  const variations = rawVariations.map(normalizeVariation).filter((v): v is DropiVariation => v !== null);
  return {
    id,
    name,
    type: variations.length > 0 ? 'VARIABLE' : 'SIMPLE',
    stock: Math.max(0, Math.floor(toNumber(rec['stock']) ?? 0)),
    salePrice: toNumber(rec['sale_price']),
    suggestedPrice: toNumber(rec['suggested_price']),
    image: firstImage(rec['gallery']),
    variations,
  };
}

export type ParsedProducts =
  | { ok: true; currency: string; products: DropiProduct[] }
  | { ok: false };

export function parseListProducts(content: string): ParsedProducts {
  const parsed = asRecord(safeParseJson(content));
  if (!parsed || !Array.isArray(parsed['items'])) return { ok: false };
  const currency = cleanText(parsed['currency'], 8).toUpperCase();
  const products = (parsed['items'] as unknown[])
    .map(normalizeProduct)
    .filter((p): p is DropiProduct => p !== null);
  return { ok: true, currency, products };
}

/**
 * Supplier cost usable for the margin check: a positive number. 0 is treated as invalid (a free
 * product is a data error, and it would make every margin check pass).
 */
export function validSupplierCost(cost: number | null): cost is number {
  return cost !== null && Number.isFinite(cost) && cost > 0;
}

/** Variations with stock ≥ qty, a sellable price and a valid supplier cost. */
export function sellableVariations(product: DropiProduct, marginPercent: number, quantity = 1): DropiVariation[] {
  return product.variations.filter(
    (v) => v.stock >= quantity && productPrice(v.suggestedPrice, marginPercent) !== null && validSupplierCost(v.salePrice)
  );
}

export function isOfferable(product: DropiProduct, marginPercent: number): boolean {
  if (product.type === 'VARIABLE') return sellableVariations(product, marginPercent).length > 0;
  return (
    product.stock > 0 &&
    productPrice(product.suggestedPrice, marginPercent) !== null &&
    validSupplierCost(product.salePrice)
  );
}

export function describeVariation(v: DropiVariation): string {
  return v.attributes.map((a) => `${a.name}: ${a.value}`).join(', ').slice(0, MAX_TEXT_LENGTH);
}

/** Product as the LLM sees it (whitelisted fields), or null when not offerable. */
export interface ProductForLlm {
  producto_id: number;
  nombre: string;
  precio?: number;
  precio_desde?: number;
  precio_hasta?: number;
  tiene_opciones: boolean;
  opciones_resumen?: Record<string, string[]>;
  imagen: string | null;
}

export const MAX_OPTION_VALUES_PER_ATTRIBUTE = 10;

export function presentProduct(product: DropiProduct, marginPercent: number): ProductForLlm | null {
  if (!isOfferable(product, marginPercent)) return null;
  if (product.type === 'SIMPLE') {
    return {
      producto_id: product.id,
      nombre: product.name,
      precio: productPrice(product.suggestedPrice, marginPercent)!,
      tiene_opciones: false,
      imagen: product.image,
    };
  }
  const variations = sellableVariations(product, marginPercent);
  const prices = variations.map((v) => productPrice(v.suggestedPrice, marginPercent)!);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const summary: Record<string, string[]> = {};
  for (const v of variations) {
    for (const a of v.attributes) {
      const list = (summary[a.name] ??= []);
      if (list.length < MAX_OPTION_VALUES_PER_ATTRIBUTE && !list.includes(a.value)) list.push(a.value);
    }
  }
  return {
    producto_id: product.id,
    nombre: product.name,
    ...(min === max ? { precio: min } : { precio_desde: min, precio_hasta: max }),
    tiene_opciones: true,
    opciones_resumen: summary,
    imagen: product.image,
  };
}

export const MAX_PRODUCTS_PER_SEARCH = 5;

export function presentProducts(products: DropiProduct[], marginPercent: number): ProductForLlm[] {
  const out: ProductForLlm[] = [];
  for (const p of products) {
    const shown = presentProduct(p, marginPercent);
    if (shown) out.push(shown);
    if (out.length >= MAX_PRODUCTS_PER_SEARCH) break;
  }
  return out;
}

export interface OptionForLlm {
  opcion_id: number;
  descripcion: string;
  precio: number;
}

export const MAX_OPTIONS = 30;

export function presentOptions(product: DropiProduct, marginPercent: number, filter?: string): OptionForLlm[] {
  const terms = filter ? normalizeKey(filter).split(' ').filter(Boolean) : [];
  const out: OptionForLlm[] = [];
  for (const v of sellableVariations(product, marginPercent)) {
    if (terms.length > 0) {
      const haystack = v.attributes.map((a) => normalizeKey(a.value)).join(' ');
      if (!terms.every((t) => haystack.includes(t))) continue;
    }
    out.push({ opcion_id: v.id, descripcion: describeVariation(v), precio: productPrice(v.suggestedPrice, marginPercent)! });
    if (out.length >= MAX_OPTIONS) break;
  }
  return out;
}

/** Longest word of a multi-word search (retry when the literal search found nothing), or null. */
export function longestWord(search: string): string | null {
  const words = search.split(' ').filter(Boolean);
  if (words.length < 2) return null;
  return words.reduce((a, b) => (b.length > a.length ? b : a));
}

// ── Catalog lists (carriers, departments, categories) ────────────────────────

export interface NamedItem {
  id: number | null;
  name: string;
}

export function parseNamedItems(content: string): NamedItem[] | null {
  const items = itemsOf(safeParseJson(content));
  if (!items) return null;
  const out: NamedItem[] = [];
  for (const it of items) {
    const rec = asRecord(it);
    if (rec) {
      const name = cleanText(rec['name']);
      if (name) out.push({ id: toId(rec['id']), name });
    } else if (typeof it === 'string') {
      const name = cleanText(it);
      if (name) out.push({ id: null, name });
    }
  }
  return out;
}

/** Category given by the LLM → Dropi's exact name (accent and case insensitive), or null. */
export function matchCategory(input: string, categories: NamedItem[]): string | null {
  const key = normalizeKey(input);
  return categories.find((c) => normalizeKey(c.name) === key)?.name ?? null;
}

// ── Cities ───────────────────────────────────────────────────────────────────

export interface DropiCity {
  id: number;
  departmentId: number | null;
  name: string;
  daneCode: string | null;
  zipCode: string | null;
}

export function parseCities(content: string): DropiCity[] | null {
  const items = itemsOf(safeParseJson(content));
  if (!items) return null;
  const out: DropiCity[] = [];
  for (const it of items) {
    const rec = asRecord(it);
    if (!rec) continue;
    const id = toId(rec['id']);
    const name = cleanText(rec['name']);
    if (id === null || !name) continue;
    const dane = cleanText(rec['cod_dane'], 20);
    const zip = cleanText(rec['zip_code'], 20);
    out.push({ id, departmentId: toId(rec['department_id']), name, daneCode: dane || null, zipCode: zip || null });
  }
  return out;
}

export type CityResolution =
  | { kind: 'found'; city: DropiCity; departmentName: string }
  | { kind: 'not_found' }
  | { kind: 'needs_department'; options: string[] };

/** City query → one Dropi city, disambiguated by department when needed. */
export function resolveCity(input: {
  query: string;
  cities: DropiCity[];
  departments: NamedItem[];
  department?: string;
}): CityResolution {
  const deptName = (id: number | null): string =>
    (id !== null ? input.departments.find((d) => d.id === id)?.name : undefined) ?? '';
  const key = normalizeKey(input.query);
  const exact = input.cities.filter((c) => normalizeKey(c.name) === key);
  let candidates = exact.length > 0 ? exact : input.cities;
  if (candidates.length === 0) return { kind: 'not_found' };

  if (candidates.length > 1 && input.department) {
    const dkey = normalizeKey(input.department);
    const filtered = candidates.filter((c) => normalizeKey(deptName(c.departmentId)) === dkey);
    if (filtered.length > 0) candidates = filtered;
  }
  if (candidates.length === 1) {
    const city = candidates[0]!;
    const departmentName = deptName(city.departmentId);
    if (!departmentName) return { kind: 'not_found' };
    return { kind: 'found', city, departmentName };
  }
  const options = [...new Set(candidates.map((c) => deptName(c.departmentId)).filter(Boolean))].slice(0, 10);
  return { kind: 'needs_department', options };
}

// ── Shipping quotes and carriers ─────────────────────────────────────────────

export interface CarrierOption {
  id: number;
  name: string;
  cost: number;
}

export type ParsedQuote =
  | { ok: true; currency: string; quotes: Array<{ name: string; cost: number }> }
  | { ok: false };

/** quote_shipping → carriers that quoted (shipping_cost != null, error == null). */
export function parseQuote(content: string): ParsedQuote {
  const parsed = asRecord(safeParseJson(content));
  if (!parsed || !Array.isArray(parsed['carriers'])) return { ok: false };
  const quotes: Array<{ name: string; cost: number }> = [];
  for (const c of parsed['carriers'] as unknown[]) {
    const rec = asRecord(c);
    if (!rec) continue;
    const cost = toNumber(rec['shipping_cost']);
    const hasError = rec['error'] !== null && rec['error'] !== undefined;
    const name = cleanText(rec['carrier']);
    if (cost === null || cost < 0 || hasError || !name) continue;
    quotes.push({ name, cost });
  }
  return { ok: true, currency: cleanText(parsed['currency'], 8).toUpperCase(), quotes };
}

/** Quotes → carriers with an id from list_carriers, deduplicated (cheapest), cheapest first. */
export function rankCarriers(quotes: Array<{ name: string; cost: number }>, catalog: NamedItem[]): CarrierOption[] {
  const byId = new Map<number, CarrierOption>();
  for (const q of quotes) {
    const match = catalog.find((c) => c.id !== null && normalizeKey(c.name) === normalizeKey(q.name));
    if (!match || match.id === null) continue;
    const prev = byId.get(match.id);
    if (!prev || q.cost < prev.cost) byId.set(match.id, { id: match.id, name: match.name, cost: q.cost });
  }
  return [...byId.values()].sort((a, b) => a.cost - b.cost || a.id - b.id);
}

// ── create_order ─────────────────────────────────────────────────────────────

export type CreateOrderOutcome =
  | { kind: 'created'; orderId: string; status: string | null; total: number | null; currency: string | null }
  /** Carrier / shipping-method rejection: try the next carrier of the quote. */
  | { kind: 'carrier_rejected' }
  /** "monto a ganar es menor o igual a cero": stop (should not happen with the pricing formula). */
  | { kind: 'no_margin' }
  /** Any other definitive rejection: the order was NOT created. */
  | { kind: 'rejected' }
  /** Network / timeout / unreadable answer: the order MAY exist. Never retried. */
  | { kind: 'unknown' };

const CARRIER_ERROR = /(medoto|metodo) de envio|transportadora|no tiene habilitad|distribution_company|sin cobertura/;
const NO_MARGIN_ERROR = /monto a ganar/;
/** Transport failures where the request certainly never reached Dropi's create_order handler. */
const DEFINITIVE_TRANSPORT_ERROR = /MCP server returned HTTP 4\d\d|MCP server URL is not allowed|Invalid MCP server URL|must use HTTPS/;

/**
 * Classifies a create_order result. `unavailableMessage` is the neutral text the OAuth wrapper
 * returns when the session is unusable (401 not recoverable / revoked): the order was not created.
 */
export function classifyCreateOrderResult(
  result: { content: string; isError: boolean },
  unavailableMessage?: string
): CreateOrderOutcome {
  if (unavailableMessage && result.content === unavailableMessage) return { kind: 'rejected' };
  const parsed = asRecord(safeParseJson(result.content));
  if (parsed) {
    const err = parsed['error'];
    if (err !== undefined && err !== null) {
      const message = normalizeKey(
        typeof err === 'string' ? err : String(asRecord(err)?.['message'] ?? '')
      ).toLowerCase();
      if (NO_MARGIN_ERROR.test(message)) return { kind: 'no_margin' };
      if (CARRIER_ERROR.test(message)) return { kind: 'carrier_rejected' };
      return { kind: 'rejected' };
    }
    const orderId = parseOrderNumber(parsed['order_id']);
    if (orderId && !result.isError) {
      return {
        kind: 'created',
        orderId,
        status: cleanText(parsed['status'], 40) || null,
        total: toNumber(parsed['total']),
        currency: cleanText(parsed['currency'], 8).toUpperCase() || null,
      };
    }
    return { kind: 'unknown' };
  }
  if (result.isError && DEFINITIVE_TRANSPORT_ERROR.test(result.content)) return { kind: 'rejected' };
  return { kind: 'unknown' };
}

// ── Confirmation rule ────────────────────────────────────────────────────────

/**
 * The buyer confirmed only if a user message arrived AFTER the turn in which the summary was
 * prepared. Turns are counted as "user messages saved + the one in flight", so the turn that
 * called dropi_preparar_pedido can never also confirm it.
 */
export function buyerRepliedSince(markerTurn: number, currentTurn: number): boolean {
  return Number.isInteger(markerTurn) && Number.isInteger(currentTurn) && currentTurn > markerTurn;
}

/**
 * Time rule, on top of the turn counter: the buyer message being processed was RECEIVED after the
 * turn that showed the summary finished (its assistant message was saved). Both instants come from
 * the server clock; a missing one (summary turn never finished, no receipt time) means "no".
 */
export function receivedAfterSummary(messageReceivedAt: number | null, summaryDeliveredAt: number | null): boolean {
  return (
    messageReceivedAt !== null &&
    summaryDeliveredAt !== null &&
    Number.isFinite(messageReceivedAt) &&
    Number.isFinite(summaryDeliveredAt) &&
    messageReceivedAt > summaryDeliveredAt
  );
}

const AFFIRMATIVE_WORDS = new Set([
  'si', 'dale', 'listo', 'confirmo', 'confirmado', 'confirmada', 'ok', 'okay', 'okey', 'correcto',
  'claro', 'perfecto', 'hagale', 'adelante', 'va',
]);
const AFFIRMATIVE_PHRASES = ['de una'];
const NEGATIVE_WORDS = new Set(['no', 'nop', 'nope']);
/** Stems: cancela/cancelar/cancelo, espera/espere/esperar, cambia/cambiar/cambio… */
const NEGATIVE_STEMS = ['cancel', 'esper', 'cambi'];

/**
 * Minimal server-side acceptance check of the buyer's last message: at least one affirmation and
 * no negation ("sí, dale" → true; "sí pero cambia la dirección", "mejor no", "espera" → false).
 * It does not stop an attacker (who will just say "sí"); it prevents accidental confirmations and
 * a confirmation driven only by injected catalog text.
 */
export function isAffirmative(text: unknown): boolean {
  if (typeof text !== 'string') return false;
  const normalized = stripControl(text)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .replace(/([a-z])\1{2,}/g, '$1') // "siii" → "si", "okkk" → "ok"
    .trim();
  if (!normalized) return false;
  const words = normalized.split(' ');
  if (words.some((w) => NEGATIVE_WORDS.has(w) || NEGATIVE_STEMS.some((s) => w.startsWith(s)))) return false;
  const padded = ` ${normalized} `;
  return words.some((w) => AFFIRMATIVE_WORDS.has(w)) || AFFIRMATIVE_PHRASES.some((p) => padded.includes(` ${p} `));
}

// ── Orders (tracking) ────────────────────────────────────────────────────────

/** Identity of the current buyer for order ownership. Nothing here can be written by the buyer or the LLM. */
export interface BuyerIdentity {
  agentId: string;
  organizationId: string;
  /** WhatsApp only: last 10 digits of channel_metadata.wa_from (Meta's signed webhook). */
  waLast10: string | null;
  /** Real conversation id (worker), null in preview. */
  conversationId: string | null;
  /** Preview session id (preview), null in the worker. */
  previewSessionId: string | null;
}

export interface OwnedOrderKeys {
  agentId: string | null;
  organizationId: string;
  conversationId: string | null;
  previewSessionId: string | null;
  ownerWaLast10: string | null;
  buyerPhoneLast10: string | null;
}

/**
 * "Own" order of the current buyer. Never uses contact_id or contacts.phone (both can be merged or
 * overwritten by the buyer / capture_variable):
 * - WhatsApp with wa_from: same agent + org and owner_wa_last10 or buyer_phone_last10 equal to
 *   last10(wa_from) — the Meta sender number IS the channel identity.
 * - Any other case: same agent + org and the same conversation (preview: the same preview session).
 * The SQL in service.ts (OWNER_WHERE) mirrors this rule; it is kept here so it can be tested.
 */
export function ownsOrder(row: OwnedOrderKeys, who: BuyerIdentity): boolean {
  if (row.agentId === null || row.agentId !== who.agentId || row.organizationId !== who.organizationId) return false;
  if (who.waLast10 !== null) return row.ownerWaLast10 === who.waLast10 || row.buyerPhoneLast10 === who.waLast10;
  if (who.conversationId !== null) return row.conversationId === who.conversationId;
  if (who.previewSessionId !== null) return row.previewSessionId === who.previewSessionId;
  return false;
}

// ── Order caps ───────────────────────────────────────────────────────────────

/** Rows of dropi_orders in the last 24 h ('desconocido' included) for one confirmation. */
export interface OrderCapCounts {
  /** 'desconocido' rows of the same conversation / preview session. */
  conversationUnknown: number;
  /** All rows of the same conversation / preview session. */
  conversation: number;
  /** All rows of the same agent with the same buyer_phone_last10. */
  phone: number;
  /** All rows of the same agent. */
  agent: number;
}

export type OrderCapRefusal = 'verifying' | 'conversation_cap' | 'phone_cap' | 'agent_cap';

/** null when the order may be created; otherwise why not (checked in this order). */
export function orderCapDecision(
  counts: OrderCapCounts,
  limits: { perConversation: number; perPhone: number; perAgent: number }
): OrderCapRefusal | null {
  if (counts.conversationUnknown > 0) return 'verifying';
  if (counts.conversation >= limits.perConversation) return 'conversation_cap';
  if (counts.phone >= limits.perPhone) return 'phone_cap';
  if (counts.agent >= limits.perAgent) return 'agent_cap';
  return null;
}

export interface ParsedOrder {
  orderId: string;
  status: string;
  /** Last 10 digits of customer.phone: server side only, for the ownership check. */
  phoneLast10: string | null;
  items: Array<{ nombre: string; cantidad: number }>;
  total: number | null;
  currency: string;
  createdAt: string;
  trackingCode: string | null;
}

export function parseGetOrder(content: string): ParsedOrder | null {
  const parsed = asRecord(safeParseJson(content));
  if (!parsed || parsed['error'] !== undefined) return null;
  const orderId = parseOrderNumber(parsed['order_id']);
  if (!orderId) return null;
  const customer = asRecord(parsed['customer']);
  const items: Array<{ nombre: string; cantidad: number }> = [];
  if (Array.isArray(parsed['items'])) {
    for (const it of parsed['items'] as unknown[]) {
      const rec = asRecord(it);
      if (!rec) continue;
      const nombre = cleanText(rec['product_name']);
      const cantidad = toNumber(rec['qty']) ?? toNumber(rec['quantity']);
      if (nombre) items.push({ nombre, cantidad: cantidad !== null ? Math.max(0, Math.floor(cantidad)) : 1 });
    }
  }
  const tracking = cleanText(parsed['tracking_code'], 60);
  return {
    orderId,
    status: cleanText(parsed['status'], 40),
    phoneLast10: last10Digits(customer?.['phone']),
    items: items.slice(0, 10),
    total: toNumber(parsed['total']),
    currency: cleanText(parsed['currency'], 8).toUpperCase(),
    createdAt: cleanText(parsed['created_at'], 40),
    trackingCode: tracking || null,
  };
}

/** shipping_company of the list_orders row with that order_id (other rows ignored). */
export function findShippingCompany(content: string, orderId: string): string | null {
  const items = itemsOf(safeParseJson(content));
  if (!items) return null;
  for (const it of items) {
    const rec = asRecord(it);
    if (rec && parseOrderNumber(rec['order_id']) === orderId) {
      return cleanText(rec['shipping_company']) || null;
    }
  }
  return null;
}

export interface OrderForLlm {
  numero_pedido: string | null;
  estado: string;
  fecha: string;
  productos: Array<{ nombre: string; cantidad: number }>;
  total: number | null;
  moneda: string;
  transportadora?: string;
  guia?: string;
}

/**
 * Trimmed order for the LLM: never customer, name, address, document or phone. The tracking code
 * (guia) only for own orders: a verified-by-phone lookup gets status, products, total and carrier.
 */
export function presentOrder(order: ParsedOrder, carrier: string | null, opts: { includeTracking: boolean } = { includeTracking: true }): OrderForLlm {
  return {
    numero_pedido: order.orderId,
    estado: order.status,
    fecha: order.createdAt,
    productos: order.items,
    total: order.total,
    moneda: order.currency,
    ...(carrier ? { transportadora: carrier } : {}),
    ...(opts.includeTracking && order.trackingCode ? { guia: order.trackingCode } : {}),
  };
}

/** YYYY-MM-DD of a Dropi date ("2026-11-10 14:03:22", "2026-11-10T…"), or null. */
export function datePart(value: string): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return m ? m[1]! : null;
}

/** YYYY-MM-DD of `now` + `days` (UTC). */
export function isoDatePlusDays(now: Date, days: number): string {
  return new Date(now.getTime() + days * 86_400_000).toISOString().slice(0, 10);
}
