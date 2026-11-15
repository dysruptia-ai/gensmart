/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers tests at import */
/**
 * Dropi sales toolkit tests: pure rules (core.ts) and the orchestration (service.ts / tools.ts)
 * with in-memory fakes for Redis, Postgres and the Dropi MCP. No network, DB or Redis.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  buyerRepliedSince,
  ceilToMultiple,
  classifyCreateOrderResult,
  estimatedProfit,
  hasPositiveMargin,
  normalizeForSearch,
  normalizeKey,
  normalizePhone,
  normalizeProduct,
  ownsOrder,
  parseGetOrder,
  parseListProducts,
  parseNamedItems,
  parseQuote,
  presentOrder,
  presentProducts,
  productPrice,
  provisionalTotal,
  rankCarriers,
  resolveCity,
  resolveMarginPercent,
  cleanText,
  twoPassTotal,
  parseCities,
  findShippingCompany,
  isAffirmative,
  isOfferable,
  orderCapDecision,
  parseLooseNumber,
  receivedAfterSummary,
  resolveMaxDailyOrders,
  type BuyerIdentity,
  type OwnedOrderKeys,
} from './core';
import type { CapNotice, DropiOrderRecord, DropiSalesContext, DropiSalesDeps, McpCallResult, NewOrderRow } from './service';
import {
  executeDropiSalesTool,
  markDropiSummaryDelivered,
  mcpToolExposure,
  requiresSelectedTools,
  dropiSalesToolDefinitions,
  type DropiSalesToolName,
} from './tools';
import { sanitizeWidgetMessageMetadata } from '../widget-metadata.service';
import * as F from './fixtures';

const FORBIDDEN_KEYS = ['sale_price', 'suggested_price', 'simple_price', 'supplier_id', 'sku', 'customer', 'stock', 'document'];

function assertNoForbiddenKeys(jsonText: string): void {
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (v && typeof v === 'object') {
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        assert.ok(!FORBIDDEN_KEYS.includes(k), `forbidden key "${k}" reached the LLM`);
        walk(val);
      }
    }
  };
  walk(JSON.parse(jsonText) as unknown);
  for (const k of FORBIDDEN_KEYS) assert.ok(!jsonText.includes(`"${k}"`), `forbidden key "${k}" in ${jsonText}`);
}

// ── Pricing ──────────────────────────────────────────────────────────────────

describe('pricing', () => {
  test('price = ceil to 100 of suggested × (1 + margin)', () => {
    assert.equal(productPrice(29166, 20), 35000); // 34 999.2 → 35 000
    assert.equal(productPrice(17900, 20), 21500); // 21 480 (float 21480.000000000004) → 21 500
    assert.equal(productPrice(10000, 0), 10000); // exact multiple stays
    assert.equal(productPrice(10001, 0), 10100);
    assert.equal(productPrice(52000, 12.5), 58500);
  });

  test('suggested_price missing or ≤ 0 → not sellable', () => {
    assert.equal(productPrice(null, 20), null);
    assert.equal(productPrice(0, 20), null);
    assert.equal(productPrice(-5, 20), null);
  });

  test('margin: default 20, clamped to 0–300', () => {
    assert.equal(resolveMarginPercent(undefined), 20);
    assert.equal(resolveMarginPercent(null), 20);
    assert.equal(resolveMarginPercent('abc'), 20);
    assert.equal(resolveMarginPercent(''), 20);
    assert.equal(resolveMarginPercent('35'), 35);
    assert.equal(resolveMarginPercent(-10), 0);
    assert.equal(resolveMarginPercent(900), 300);
  });

  test('config numbers typed by people: "20%", "20,5" and spaces (DS-11)', () => {
    assert.equal(resolveMarginPercent('20%'), 20);
    assert.equal(resolveMarginPercent(' 20,5 '), 20.5);
    assert.equal(resolveMarginPercent(' 35 % '), 35);
    assert.equal(parseLooseNumber('1 000'), 1000);
    assert.equal(parseLooseNumber('20,5,1'), null);
    assert.equal(parseLooseNumber('veinte'), null);
  });

  test('max_pedidos_diarios: default 50, integer in 1–1000', () => {
    assert.equal(resolveMaxDailyOrders(undefined), 50);
    assert.equal(resolveMaxDailyOrders(''), 50);
    assert.equal(resolveMaxDailyOrders('abc'), 50);
    assert.equal(resolveMaxDailyOrders('80'), 80);
    assert.equal(resolveMaxDailyOrders(' 12,7 '), 12);
    assert.equal(resolveMaxDailyOrders(0), 1);
    assert.equal(resolveMaxDailyOrders(-3), 1);
    assert.equal(resolveMaxDailyOrders(5000), 1000);
  });

  test('total is a multiple of 100 × quantity (unit price always a multiple of 100)', () => {
    assert.equal(ceilToMultiple(48028, 100), 48100);
    assert.equal(ceilToMultiple(48000, 100), 48000);
    const total = provisionalTotal(2 * 21500, 12686, 2); // 55 686 → multiple of 200
    assert.equal(total, 55800);
    assert.equal((total / 2) % 100, 0);
    const t3 = provisionalTotal(3 * 21500, 12686, 3); // 77 186 → multiple of 300
    assert.equal(t3 % 300, 0);
    assert.ok(t3 >= 77186 && t3 - 77186 < 300);
  });

  test('two-pass total: second quote raises the total', () => {
    const r = twoPassTotal({ subtotal: 35000, quantity: 1, firstShipping: 13028, secondShipping: 13290 });
    assert.equal(r.total, 48300);
    assert.equal(r.shownShipping, 13300);
    assert.equal(r.quotedShipping, 13290);
    assert.equal(r.chargedUnitPrice, 48300);
    assert.equal(r.usedFallback, false);
  });

  test('two-pass total: a lower second quote keeps the provisional total', () => {
    const r = twoPassTotal({ subtotal: 35000, quantity: 1, firstShipping: 13028, secondShipping: 12000 });
    assert.equal(r.total, 48100);
  });

  test('two-pass total: second quote failed → first + 5 % on shipping', () => {
    const r = twoPassTotal({ subtotal: 21500, quantity: 1, firstShipping: 12686, secondShipping: null });
    assert.equal(r.total, 34900); // 21 500 + 13 320.3 → 34 900
    assert.equal(r.usedFallback, true);
    const q2 = twoPassTotal({ subtotal: 43000, quantity: 2, firstShipping: 12686, secondShipping: null });
    assert.equal(q2.total % 200, 0);
    assert.equal(q2.chargedUnitPrice % 100, 0);
  });

  test('margin check with the real settlement of order 96972142', () => {
    // Total 35 000, shipping 13 028, supplier 14 900, real commission 1 098.60 → real profit 5 973.
    const est = estimatedProfit({ total: 35000, shipping: 13028, supplierCost: 14900, quantity: 1 });
    assert.equal(est, 35000 - 13028 - 14900 - 1225);
    assert.ok(est > 0 && est <= 5973, 'estimate (3.5 %) must be ≤ the real profit (≈3.14 %)');
    assert.equal(hasPositiveMargin({ total: 35000, shipping: 13028, supplierCost: 14900, quantity: 1 }), true);
    assert.equal(hasPositiveMargin({ total: 35000, shipping: 19000, supplierCost: 14900, quantity: 1 }), false);
  });
});

// ── Normalization ────────────────────────────────────────────────────────────

describe('normalization', () => {
  test('accents and spaces', () => {
    assert.equal(normalizeKey('Cajicá'), 'CAJICA');
    assert.equal(normalizeKey('  Bogotá   D.C. '), 'BOGOTA D.C.');
    assert.equal(normalizeForSearch('  papel   adhesivo '), 'papel adhesivo');
    assert.equal(normalizeForSearch('Sábana térmica'), 'Sabana termica');
  });

  test('phones', () => {
    assert.equal(normalizePhone('+57 317 430 4027'), '3174304027');
    assert.equal(normalizePhone('573174304027'), '3174304027');
    assert.equal(normalizePhone('317-430-4027'), '3174304027');
    assert.equal(normalizePhone('31743040'), null);
    assert.equal(normalizePhone('5731743040271'), null);
  });

  test('provider text: control chars stripped and truncated to 120', () => {
    assert.equal(cleanText('Hola\u0000\u001b[31m mundo‮'), 'Hola [31m mundo');
    assert.equal(cleanText('x'.repeat(300)).length, 120);
  });
});

// ── Products ─────────────────────────────────────────────────────────────────

describe('products', () => {
  const parsed = parseListProducts(JSON.stringify(F.LIST_PRODUCTS));
  assert.ok(parsed.ok);
  const [simple, variable, soldOut, noPrice] = parsed.products;

  test('variations: [{}] → simple; numeric ids → variable', () => {
    assert.equal(simple!.type, 'SIMPLE');
    assert.equal(simple!.variations.length, 0);
    assert.equal(variable!.type, 'VARIABLE');
    assert.equal(variable!.variations.length, 3);
    assert.equal(normalizeProduct({ id: 1, name: 'x', variations: {} })!.type, 'SIMPLE');
  });

  test('gallery: urlS3 or url', () => {
    assert.equal(simple!.image, 'https://cdn.dropi.co/rmp.jpg');
    assert.equal(variable!.image, 'https://cdn.dropi.co/sab.jpg');
    assert.equal(normalizeProduct({ id: 1, name: 'x', gallery: [{ url: 'javascript:alert(1)' }] })!.image, null);
  });

  test('variable product with stock 0 is offered when variations have stock; price from variations', () => {
    const shown = presentProducts(parsed.products, 20);
    assert.deepEqual(shown.map((p) => p.producto_id), [101, 202]); // sold out and no-price excluded
    const sab = shown[1]!;
    assert.equal(sab.precio_desde, 62400);
    assert.equal(sab.precio_hasta, 72000);
    assert.deepEqual(sab.opciones_resumen, { COLOR: ['BEIGE'], MEDIDA: ['SENCILLA', 'DOBLE'] }); // GRIS has no stock
    assert.equal(shown[0]!.precio, 35000);
    void soldOut;
    void noPrice;
  });

  test('supplier cost 0 or missing → product not offered (DS-11)', () => {
    const free = normalizeProduct({ ...F.LIST_PRODUCTS.items[0], sale_price: 0 })!;
    assert.equal(isOfferable(free, 20), false);
    const noCost = normalizeProduct({ ...F.LIST_PRODUCTS.items[0], sale_price: null })!;
    assert.equal(isOfferable(noCost, 20), false);
    assert.equal(isOfferable(simple!, 20), true);
  });

  test('trimmed JSON for the LLM has no costs, sku, supplier, stock or customer', () => {
    assertNoForbiddenKeys(JSON.stringify({ productos: presentProducts(parsed.products, 20) }));
  });
});

// ── Cities, carriers, create_order errors ────────────────────────────────────

describe('cities and carriers', () => {
  const departments = parseNamedItems(JSON.stringify(F.LIST_DEPARTMENTS))!;

  test('city found (accentless upper case) and disambiguation by department', () => {
    const one = resolveCity({ query: 'Cajicá', cities: parseCities(JSON.stringify(F.SEARCH_CITIES_CAJICA))!, departments });
    assert.equal(one.kind, 'found');
    if (one.kind === 'found') assert.equal(one.departmentName, 'CUNDINAMARCA');

    const cities = parseCities(JSON.stringify(F.SEARCH_CITIES_AMBIGUOUS))!;
    const amb = resolveCity({ query: 'Guayabal', cities, departments });
    assert.deepEqual(amb, { kind: 'needs_department', options: ['CUNDINAMARCA', 'RISARALDA'] });
    const ok = resolveCity({ query: 'Guayabal', cities, departments, department: 'Risaralda' });
    assert.equal(ok.kind === 'found' && ok.city.id, 2002);
    assert.deepEqual(resolveCity({ query: 'x', cities: [], departments }), { kind: 'not_found' });
  });

  test('carriers: only quoted ones with an id, cheapest first', () => {
    const q = parseQuote(JSON.stringify(F.quoteShipping({ envia: 13028, derocha: 12900 })));
    assert.ok(q.ok);
    const ranked = rankCarriers(q.quotes, parseNamedItems(JSON.stringify(F.LIST_CARRIERS))!);
    assert.deepEqual(ranked, [
      { id: 2, name: 'DEROCHA-EXPRESS', cost: 12900 },
      { id: 1, name: 'ENVIA', cost: 13028 },
    ]); // INTERRAPIDISIMO (error/null) and DESCONOCIDA (no id) dropped
  });

  test('create_order classification with the real messages', () => {
    const r = (v: unknown, isError = false) => classifyCreateOrderResult({ content: JSON.stringify(v), isError });
    assert.deepEqual(r(F.CREATE_ORDER_OK), { kind: 'created', orderId: '96972142', status: 'PENDIENTE', total: 35000, currency: 'COP' });
    assert.equal(r(F.CREATE_ORDER_CARRIER_ERROR).kind, 'carrier_rejected');
    assert.equal(r(F.CREATE_ORDER_CARRIER_ERROR, true).kind, 'carrier_rejected');
    assert.equal(r({ error: { code: 3, message: 'La transportadora no está disponible' } }).kind, 'carrier_rejected');
    assert.equal(r(F.CREATE_ORDER_NO_MARGIN_ERROR).kind, 'no_margin');
    assert.equal(r({ error: { code: 1, message: 'El teléfono es inválido' } }).kind, 'rejected');
    assert.equal(classifyCreateOrderResult({ content: 'MCP tool execution failed: MCP request timeout: tools/call (30s)', isError: true }).kind, 'unknown');
    assert.equal(classifyCreateOrderResult({ content: 'MCP tool execution failed: fetch failed', isError: true }).kind, 'unknown');
    assert.equal(classifyCreateOrderResult({ content: '(no output)', isError: false }).kind, 'unknown');
    assert.equal(classifyCreateOrderResult({ content: 'MCP tool execution failed: MCP server returned HTTP 400: bad', isError: true }).kind, 'rejected');
    assert.equal(classifyCreateOrderResult({ content: 'No pude consultar Dropi en este momento. Intenta de nuevo más tarde.', isError: true }, 'No pude consultar Dropi en este momento. Intenta de nuevo más tarde.').kind, 'rejected');
  });

  test('orders: trimmed view without customer; carrier from the matching list_orders row', () => {
    const o = parseGetOrder(JSON.stringify(F.GET_ORDER))!;
    assert.equal(o.phoneLast10, '3174304027');
    const carrier = findShippingCompany(JSON.stringify(F.LIST_ORDERS), '96972142');
    assert.equal(carrier, 'ENVIA');
    const out = JSON.stringify(presentOrder(o, carrier));
    assertNoForbiddenKeys(out);
    for (const pii of ['Ana', 'Pérez', '3174304027', '1020304050', 'Calle 1']) assert.ok(!out.includes(pii), `PII "${pii}" leaked`);
  });
});

// ── Confirmation and ownership rules ─────────────────────────────────────────

describe('pure rules', () => {
  test('confirmation: needs a user turn after the marker', () => {
    assert.equal(buyerRepliedSince(3, 3), false);
    assert.equal(buyerRepliedSince(3, 2), false);
    assert.equal(buyerRepliedSince(3, 4), true);
    assert.equal(buyerRepliedSince(Number.NaN, 4), false);
  });

  test('confirmation: buyer message received after the summary turn finished (DS-07)', () => {
    assert.equal(receivedAfterSummary(2000, 1000), true);
    assert.equal(receivedAfterSummary(1000, 1000), false);
    assert.equal(receivedAfterSummary(500, 1000), false);
    assert.equal(receivedAfterSummary(null, 1000), false); // no reliable receipt time → no
    assert.equal(receivedAfterSummary(2000, null), false); // summary turn never finished → no
  });

  test('isAffirmative: affirmation and no negation (DS-07)', () => {
    for (const yes of ['sí', 'Si', 'SIII!', 'dale', 'listo', 'Confirmo', 'confirmado', 'ok', 'Okay 👍', 'de una', 'correcto',
      'claro que sí', 'perfecto, gracias', 'Hágale', 'hagale pues', 'adelante', 'va', 'Sí, dale.']) {
      assert.equal(isAffirmative(yes), true, yes);
    }
    for (const no of ['no', 'No.', 'mejor no', 'cancela', 'cancelar el pedido', 'espera', 'espérame', 'cambia la dirección',
      'sí pero cambiar la talla', 'dale, no espera', 'gracias', '', '   ', '¿cuánto es el envío?', 'Sigo pensando', 'vale']) {
      assert.equal(isAffirmative(no), false, no);
    }
    assert.equal(isAffirmative(undefined), false);
  });

  test('order caps: verifying first, then conversation, phone and agent', () => {
    const limits = { perConversation: 2, perPhone: 2, perAgent: 50 };
    const base = { conversationUnknown: 0, conversation: 0, phone: 0, agent: 0 };
    assert.equal(orderCapDecision(base, limits), null);
    assert.equal(orderCapDecision({ ...base, conversationUnknown: 1, conversation: 1 }, limits), 'verifying');
    assert.equal(orderCapDecision({ ...base, conversation: 2 }, limits), 'conversation_cap');
    assert.equal(orderCapDecision({ ...base, conversation: 1, phone: 2 }, limits), 'phone_cap');
    assert.equal(orderCapDecision({ ...base, agent: 50 }, limits), 'agent_cap');
    assert.equal(orderCapDecision({ ...base, conversation: 1, phone: 1, agent: 49 }, limits), null);
  });

  test('ownership: wa_from on WhatsApp, else the conversation / preview session; never contact_id (DS-02/DS-04)', () => {
    const row: OwnedOrderKeys = { agentId: 'A', organizationId: 'O', conversationId: 'conv-1', previewSessionId: null, ownerWaLast10: '3174304027', buyerPhoneLast10: '3110000000' };
    const who = (over: Partial<BuyerIdentity>): BuyerIdentity => ({ agentId: 'A', organizationId: 'O', waLast10: null, conversationId: null, previewSessionId: null, ...over });
    assert.equal(ownsOrder(row, who({ conversationId: 'conv-1' })), true);
    assert.equal(ownsOrder(row, who({ conversationId: 'conv-2' })), false); // same contact, other conversation: no
    assert.equal(ownsOrder(row, who({ agentId: 'B', conversationId: 'conv-1' })), false);
    assert.equal(ownsOrder(row, who({ organizationId: 'P', conversationId: 'conv-1' })), false);
    assert.equal(ownsOrder(row, who({ waLast10: '3174304027', conversationId: 'conv-9' })), true); // owner_wa_last10
    assert.equal(ownsOrder(row, who({ waLast10: '3110000000', conversationId: 'conv-9' })), true); // buyer_phone_last10
    assert.equal(ownsOrder(row, who({ waLast10: '3009999999', conversationId: 'conv-1' })), false); // WhatsApp: phones only
    assert.equal(ownsOrder({ ...row, agentId: null }, who({ conversationId: 'conv-1' })), false); // agent deleted
    const preview: OwnedOrderKeys = { ...row, conversationId: null, previewSessionId: 'ps-1', ownerWaLast10: null };
    assert.equal(ownsOrder(preview, who({ previewSessionId: 'ps-1' })), true);
    assert.equal(ownsOrder(preview, who({ previewSessionId: 'ps-2' })), false);
    assert.equal(ownsOrder(preview, who({})), false);
  });
});

// ── Worker / preview activation ──────────────────────────────────────────────

describe('activation (worker and preview)', () => {
  const oauth = { toolId: 't', agentId: 'a', providerId: 'dropi', providerName: 'Dropi', sessionId: 's' };
  test('Dropi with a valid connection → sales tools, never raw', () => {
    assert.equal(mcpToolExposure({ providerId: 'dropi' }, { oauth, needsReconnect: false }), 'dropi_sales');
    assert.equal(mcpToolExposure({ providerId: 'dropi' }, { oauth: null, needsReconnect: true }), 'hidden');
    assert.equal(mcpToolExposure({ providerId: 'dropi' }, { oauth: null, needsReconnect: false }), 'hidden');
    assert.equal(requiresSelectedTools({ providerId: 'dropi' }), false);
    const names = dropiSalesToolDefinitions.map((d) => d.name);
    assert.ok(names.every((n) => n.startsWith('dropi_')));
    assert.ok(!names.some((n) => ['create_order', 'get_order', 'list_orders', 'list_products'].includes(n)));
  });

  test('other providers unchanged', () => {
    for (const providerId of ['mastershop', 'venndelo', 'woocommerce', 'tiendanube', undefined]) {
      assert.equal(mcpToolExposure({ providerId }, { oauth: null, needsReconnect: false }), 'raw');
      assert.equal(requiresSelectedTools({ providerId }), true);
    }
    const otherOAuth = { ...oauth, providerId: 'tiendanube' };
    assert.equal(mcpToolExposure({ providerId: 'tiendanube' }, { oauth: otherOAuth, needsReconnect: false }), 'raw');
  });
});

// ── Orchestration with fakes ─────────────────────────────────────────────────

interface Harness {
  deps: DropiSalesDeps;
  calls: Array<{ tool: string; args: Record<string, unknown> }>;
  rows: Array<NewOrderRow & DropiOrderRecord>;
  logs: string[];
  notices: CapNotice[];
  handlers: Record<string, (args: Record<string, unknown>) => McpCallResult>;
  config: Record<string, unknown>;
  /** Server clock (ms) used by deps.now(); tests advance it. */
  clock: { t: number };
  ctx: (over?: Partial<DropiSalesContext>) => DropiSalesContext;
  run: (name: DropiSalesToolName, args: Record<string, unknown>, ctx: DropiSalesContext) => Promise<Record<string, unknown>>;
  /** End of the turn: the assistant message is saved (worker saveMessages / preview history). */
  endTurn: (ctx: DropiSalesContext) => Promise<void>;
}

const ok = (v: unknown): McpCallResult => ({ content: JSON.stringify(v), isError: false });

/** ENVIA cost grows with the declared value, as observed (17 900 → 12 686, 35 000 → 13 028). */
const enviaCost = (price: number): number => 12686 + Math.round((price - 17900) * 0.02);

function harness(): Harness {
  const kv = new Map<string, string>();
  const hashes = new Map<string, Map<string, string>>();
  const calls: Harness['calls'] = [];
  const rows: Harness['rows'] = [];
  const logs: string[] = [];
  const notices: CapNotice[] = [];
  const config: Record<string, unknown> = { porcentaje_margen: 20 };
  const clock = { t: Date.parse('2026-11-14T12:00:00Z') };
  let seq = 0;
  const handlers: Harness['handlers'] = {
    list_products: () => ok(F.LIST_PRODUCTS),
    list_categories: () => ok(F.LIST_CATEGORIES),
    list_departments: () => ok(F.LIST_DEPARTMENTS),
    list_carriers: () => ok(F.LIST_CARRIERS),
    search_cities: () => ok(F.SEARCH_CITIES_CAJICA),
    quote_shipping: (args) => {
      const price = Number(((args['products'] as Array<Record<string, unknown>>)[0]!)['price']);
      return ok(F.quoteShipping({ envia: enviaCost(price), derocha: enviaCost(price) + 300 }));
    },
    create_order: () => ok(F.CREATE_ORDER_OK),
    get_order: () => ok(F.GET_ORDER),
    list_orders: () => ok(F.LIST_ORDERS),
  };
  const keysOf = (r: NewOrderRow): OwnedOrderKeys => ({
    agentId: r.agentId, organizationId: r.organizationId, conversationId: r.conversationId,
    previewSessionId: r.previewSessionId, ownerWaLast10: r.ownerWaLast10, buyerPhoneLast10: r.buyerPhoneLast10,
  });
  const deps: DropiSalesDeps = {
    kv: {
      get: async (k) => kv.get(k) ?? null,
      set: async (k, v) => { kv.set(k, v); },
      setNx: async (k, v) => { if (kv.has(k)) return false; kv.set(k, v); return true; },
      del: async (k) => { kv.delete(k); },
      incrWithTtl: async (k) => { const n = Number(kv.get(k) ?? 0) + 1; kv.set(k, String(n)); return n; },
      hget: async (k, f) => hashes.get(k)?.get(f) ?? null,
      hsetWithTtl: async (k, entries) => {
        const h = hashes.get(k) ?? new Map<string, string>();
        for (const [f, v] of Object.entries(entries)) h.set(f, v);
        hashes.set(k, h);
      },
    },
    orders: {
      // Same contract as the SQL version: count (last 24 h, all rows here) and insert in one step.
      insertPendingWithinLimits: async (row, limits) => {
        const mine = rows.filter((r) => r.agentId === row.agentId && r.organizationId === row.organizationId);
        const inScope = mine.filter((r) =>
          row.conversationId !== null ? r.conversationId === row.conversationId
            : row.previewSessionId !== null && r.previewSessionId === row.previewSessionId);
        const refusal = orderCapDecision({
          conversationUnknown: inScope.filter((r) => r.statusLocal === 'desconocido').length,
          conversation: inScope.length,
          phone: mine.filter((r) => r.buyerPhoneLast10 === row.buyerPhoneLast10).length,
          agent: mine.length,
        }, limits);
        if (refusal) return { ok: false, reason: refusal };
        rows.push({ ...row, externalOrderId: null, statusLocal: 'desconocido', statusCached: null, createdAt: '2026-11-10T19:03:22Z' });
        return { ok: true };
      },
      markCreated: async ({ id, agentId, externalOrderId, status }) => {
        const r = rows.find((x) => x.id === id && x.agentId === agentId)!;
        Object.assign(r, { externalOrderId, statusLocal: 'creada', statusCached: status });
      },
      markUnknown: async () => {},
      deletePending: async (id, agentId) => {
        const i = rows.findIndex((x) => x.id === id && x.agentId === agentId && x.externalOrderId === null);
        if (i >= 0) rows.splice(i, 1);
      },
      findOwnRecent: async (o, limit) => rows.filter((r) => ownsOrder(keysOf(r), o)).slice(0, limit),
      findOwnByNumber: async (o, n) => rows.find((r) => ownsOrder(keysOf(r), o) && r.externalOrderId === n) ?? null,
      updateStatusCached: async () => {},
    },
    loadConfigValue: async (_agentId, key) => config[key],
    notifyCapReached: async (n) => { notices.push(n); },
    log: { info: (m) => logs.push(m), warn: (m) => logs.push(m), error: (m) => logs.push(m) },
    randomId: () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`,
    now: () => new Date(clock.t),
  };
  const ctx = (over: Partial<DropiSalesContext> = {}): DropiSalesContext => ({
    call: async (tool, args) => {
      calls.push({ tool, args });
      const h = handlers[tool];
      return h ? h(args) : { content: 'unknown tool', isError: true };
    },
    unavailableMessage: 'No pude consultar Dropi en este momento. Intenta de nuevo más tarde.',
    toolId: 'tool-1',
    agentId: 'agent-1',
    organizationId: 'org-1',
    scopeId: 'conv-1',
    conversationId: 'conv-1',
    previewSessionId: null,
    contactId: 'contact-1',
    channel: 'web',
    waFrom: null,
    currentUserTurn: 1,
    // By default the message arrived "now" (after anything stamped earlier).
    currentMessageReceivedAt: clock.t + 1,
    lastBuyerMessage: 'Sí, confirmo',
    turn: { preparedToken: null },
    ...over,
  });
  const run: Harness['run'] = async (name, args, c) =>
    JSON.parse(await executeDropiSalesTool(name, args, c, deps)) as Record<string, unknown>;
  const endTurn: Harness['endTurn'] = async (c) => {
    await markDropiSummaryDelivered(c, deps);
    clock.t += 1000; // the buyer's next message arrives later
  };
  return { deps, calls, rows, logs, notices, handlers, config, clock, ctx, run, endTurn };
}

const BUYER = { nombre: 'Ana', apellido: 'Pérez', direccion: 'Calle 1 # 2-3', telefono: '+57 317 430 4027', barrio: 'Centro' };

async function quoteFlow(h: Harness, c: DropiSalesContext): Promise<Record<string, unknown>> {
  await h.run('dropi_buscar_productos', { busqueda: 'Rompecabezas' }, c);
  return h.run('dropi_cotizar_envio', { producto_id: 101, cantidad: 1, ciudad: 'Cajicá' }, c);
}

/** Quote + prepare in one turn, then the turn ends (summary saved); the next message is later. */
async function prepared(h: Harness, turn: number, over: Partial<DropiSalesContext> = {}) {
  const c = h.ctx({ currentUserTurn: turn, ...over });
  const quote = await quoteFlow(h, c);
  const prep = await h.run('dropi_preparar_pedido', { cotizacion_id: quote['cotizacion_id'], ...BUYER }, c);
  await h.endTurn(c);
  return { quote, prep, c };
}

describe('sales flow (fakes)', () => {
  test('search: at most 5 trimmed products, cached per conversation', async () => {
    const h = harness();
    const out = await h.run('dropi_buscar_productos', { busqueda: 'Rompecabezas' }, h.ctx());
    assertNoForbiddenKeys(JSON.stringify(out));
    assert.equal((out['productos'] as unknown[]).length, 2);
    assert.equal(out['moneda'], 'COP');
    assert.deepEqual(h.calls[0], { tool: 'list_products', args: { search: 'Rompecabezas', page_size: 10, get_stock: true } });
  });

  test('search: 0 results with several words → one retry with the longest word', async () => {
    const h = harness();
    h.handlers['list_products'] = (a) => ok(a['search'] === 'adhesivo' ? F.LIST_PRODUCTS : { items: [], count: 0, currency: 'COP' });
    const out = await h.run('dropi_buscar_productos', { busqueda: 'papel adhesivo' }, h.ctx());
    assert.deepEqual(h.calls.map((c) => c.args['search']), ['papel adhesivo', 'adhesivo']);
    assert.equal((out['productos'] as unknown[]).length, 2);
  });

  test('search: empty → suggestion; non-COP → neutral', async () => {
    const h = harness();
    h.handlers['list_products'] = () => ok({ items: [], count: 0, currency: 'COP' });
    assert.deepEqual(await h.run('dropi_buscar_productos', { busqueda: 'nada' }, h.ctx()), {
      productos: [],
      sugerencia: 'Pide al cliente que describa el producto con otras palabras',
    });
    h.handlers['list_products'] = () => ok({ ...F.LIST_PRODUCTS, currency: 'MXN' });
    assert.ok(typeof (await h.run('dropi_buscar_productos', { busqueda: 'x' }, h.ctx()))['error'] === 'string');
  });

  test('category: matched without accents/case and sent with Dropi exact name', async () => {
    const h = harness();
    await h.run('dropi_buscar_productos', { busqueda: 'sabana', categoria: 'hógar' }, h.ctx());
    assert.equal(h.calls.find((c) => c.tool === 'list_products')!.args['category'], 'Hogar');
  });

  test('options: only stocked variations; filter by attribute value', async () => {
    const h = harness();
    const c = h.ctx();
    await h.run('dropi_buscar_productos', { busqueda: 'sabana' }, c);
    const out = await h.run('dropi_ver_opciones', { producto_id: 202, filtro: 'doble' }, c);
    assert.deepEqual(out['opciones'], [{ opcion_id: 9002, descripcion: 'COLOR: BEIGE, MEDIDA: DOBLE', precio: 72000 }]);
    assertNoForbiddenKeys(JSON.stringify(out));
  });

  test('quote: two passes, total from the second quote, no carriers or costs exposed', async () => {
    const h = harness();
    const out = await quoteFlow(h, h.ctx());
    const quotes = h.calls.filter((c) => c.tool === 'quote_shipping');
    assert.equal(quotes.length, 2);
    const priceOf = (i: number) => (quotes[i]!.args['products'] as Array<Record<string, unknown>>)[0]!['price'];
    assert.equal(priceOf(0), 35000);
    assert.equal(priceOf(1), 48100); // ceil100(35 000 + 13 028)
    assert.deepEqual(quotes[0]!.args['destination_city'], { id: 1234, dane_code: '25126', zip_code: null });
    assert.equal(quotes[0]!.args['cash_on_delivery'], true);
    assert.equal(out['precio_unitario'], 35000);
    assert.equal(out['total'], 48300); // ceil100(35 000 + 13 290)
    assert.equal(out['envio'], 13300);
    assert.equal(out['pago'], 'contra entrega');
    const text = JSON.stringify(out);
    assertNoForbiddenKeys(text);
    for (const leak of ['ENVIA', 'DEROCHA', 'carriers', '14900', 'distribution']) assert.ok(!text.includes(leak), `${leak} leaked`);
  });

  test('quote: variable product requires a stocked option', async () => {
    const h = harness();
    const c = h.ctx();
    await h.run('dropi_buscar_productos', { busqueda: 'sabana' }, c);
    assert.ok((await h.run('dropi_cotizar_envio', { producto_id: 202, cantidad: 1, ciudad: 'Cajica' }, c))['error']);
    assert.ok((await h.run('dropi_cotizar_envio', { producto_id: 202, opcion_id: 9003, cantidad: 1, ciudad: 'Cajica' }, c))['error']);
    assert.ok((await h.run('dropi_cotizar_envio', { producto_id: 202, opcion_id: 9002, cantidad: 3, ciudad: 'Cajica' }, c))['error']);
    const ok2 = await h.run('dropi_cotizar_envio', { producto_id: 202, opcion_id: 9002, cantidad: 2, ciudad: 'Cajica' }, c);
    assert.equal(ok2['precio_unitario'], 72000);
    assert.equal((ok2['total'] as number) % 200, 0);
    const q = h.calls.filter((x) => x.tool === 'quote_shipping')[0]!;
    assert.deepEqual((q.args['products'] as unknown[])[0], { id: 202, type: 'VARIABLE', quantity: 2, price: 72000, variation_id: 9002 });
  });

  test('quote: city not found / needs department / no coverage', async () => {
    const h = harness();
    const c = h.ctx();
    await h.run('dropi_buscar_productos', { busqueda: 'x' }, c);
    h.handlers['search_cities'] = () => ok({ items: [] });
    assert.deepEqual(await h.run('dropi_cotizar_envio', { producto_id: 101, cantidad: 1, ciudad: 'Nada' }, c), { ciudad_no_encontrada: true });
    h.handlers['search_cities'] = () => ok(F.SEARCH_CITIES_AMBIGUOUS);
    assert.deepEqual(await h.run('dropi_cotizar_envio', { producto_id: 101, cantidad: 1, ciudad: 'Guayabal' }, c), {
      necesita_departamento: true,
      opciones: ['CUNDINAMARCA', 'RISARALDA'],
    });
    h.handlers['search_cities'] = () => ok(F.SEARCH_CITIES_CAJICA);
    h.handlers['quote_shipping'] = () => ok({ carriers: [{ carrier: 'ENVIA', shipping_cost: null, error: 'x' }], currency: 'COP' });
    assert.deepEqual(await h.run('dropi_cotizar_envio', { producto_id: 101, cantidad: 1, ciudad: 'Cajica' }, c), { sin_cobertura: true });
  });

  test('quote: non-positive margin is refused and logged', async () => {
    const h = harness();
    h.handlers['quote_shipping'] = () => ok(F.quoteShipping({ envia: 1, derocha: 2 }));
    h.config['porcentaje_margen'] = 0; // price 29 200 vs supplier 14 900: still positive
    const c = h.ctx();
    assert.ok((await quoteFlow(h, c))['cotizacion_id']);
    h.handlers['quote_shipping'] = () => ok(F.quoteShipping({ envia: 40000, derocha: 41000 }));
    // Expensive shipping is passed to the buyer by the formula, so the margin stays positive: force a
    // negative one by making the supplier cost higher than the price.
    h.handlers['list_products'] = () => ok({ ...F.LIST_PRODUCTS, items: [{ ...F.LIST_PRODUCTS.items[0], sale_price: 90000 }] });
    const out = await quoteFlow(h, c);
    assert.ok(typeof out['error'] === 'string');
    assert.ok(h.logs.some((l) => l.includes('non-positive margin')));
  });

  test('quote: rate limit per conversation', async () => {
    const h = harness();
    const c = h.ctx();
    await h.run('dropi_buscar_productos', { busqueda: 'x' }, c);
    for (let i = 0; i < 30; i++) await h.run('dropi_cotizar_envio', { producto_id: 101, cantidad: 1, ciudad: 'Cajica' }, c);
    const out = await h.run('dropi_cotizar_envio', { producto_id: 101, cantidad: 1, ciudad: 'Cajica' }, c);
    assert.match(String(out['error']), /límite/);
  });
});

describe('confirmation and idempotency (fakes)', () => {

  test('prepare: validates the buyer data and returns a summary + instruction', async () => {
    const h = harness();
    const c = h.ctx();
    const quote = await quoteFlow(h, c);
    const bad = await h.run('dropi_preparar_pedido', { cotizacion_id: quote['cotizacion_id'], ...BUYER, telefono: '123' }, c);
    assert.match(String(bad['error']), /telefono/);
    const { prep } = await prepared(h, 1);
    const resumen = prep['resumen'] as Record<string, unknown>;
    assert.equal(resumen['telefono'], '3174304027');
    assert.equal(resumen['total'], 48300);
    assert.match(String(prep['instruccion']), /confirmación explícita/);
  });

  test('no new user message → nothing created; new message → created once', async () => {
    const h = harness();
    const { prep } = await prepared(h, 3);
    const token = prep['pedido_token'];
    const same = await h.run('dropi_confirmar_pedido', { pedido_token: token }, h.ctx({ currentUserTurn: 3 }));
    assert.equal(same['requiere_confirmacion'], true);
    assert.equal(h.calls.filter((c) => c.tool === 'create_order').length, 0);

    const next = await h.run('dropi_confirmar_pedido', { pedido_token: token }, h.ctx({ currentUserTurn: 4 }));
    assert.deepEqual(next, { pedido_creado: true, numero_pedido: '96972142', total: 48300, moneda: 'COP', pago: 'contra entrega' });
    const orders = h.calls.filter((c) => c.tool === 'create_order');
    assert.equal(orders.length, 1);
    const a = orders[0]!.args;
    assert.equal(a['rate_type'], 'CON RECAUDO');
    assert.equal(a['distribution_company_id'], 1); // cheapest (ENVIA) of the 2nd quote — not the LLM's choice
    assert.equal(a['state'], 'CUNDINAMARCA');
    assert.equal(a['city'], 'CAJICA');
    assert.equal(a['phone'], '3174304027');
    assert.equal(a['colonia'], 'Centro');
    assert.deepEqual(a['products'], [{ id: 101, price: 48300, quantity: 1 }]);
    assert.equal(a['shop_order_id'], h.rows[0]!.id);
    assert.equal(h.rows[0]!.externalOrderId, '96972142');
    assert.equal(h.rows[0]!.statusLocal, 'creada');

    // Idempotent: the same token returns the same order and never calls create_order again.
    const again = await h.run('dropi_confirmar_pedido', { pedido_token: token }, h.ctx({ currentUserTurn: 5 }));
    assert.deepEqual(again, next);
    assert.equal(h.calls.filter((c) => c.tool === 'create_order').length, 1);
  });

  test('concurrent confirmation: the lock lets only one through', async () => {
    const h = harness();
    const { prep } = await prepared(h, 1);
    const c = h.ctx({ currentUserTurn: 2 });
    const [r1, r2] = await Promise.all([
      h.run('dropi_confirmar_pedido', { pedido_token: prep['pedido_token'] }, c),
      h.run('dropi_confirmar_pedido', { pedido_token: prep['pedido_token'] }, c),
    ]);
    assert.equal(h.calls.filter((x) => x.tool === 'create_order').length, 1);
    assert.ok([r1, r2].some((r) => r['pedido_creado'] === true));
  });

  test('carrier rejection → next carrier; no-margin → stop; network → unknown, never retried', async () => {
    const h = harness();
    let n = 0;
    h.handlers['create_order'] = () => (++n === 1 ? ok(F.CREATE_ORDER_CARRIER_ERROR) : ok(F.CREATE_ORDER_OK));
    const { prep } = await prepared(h, 1);
    const out = await h.run('dropi_confirmar_pedido', { pedido_token: prep['pedido_token'] }, h.ctx({ currentUserTurn: 2 }));
    assert.equal(out['pedido_creado'], true);
    const ids = h.calls.filter((c) => c.tool === 'create_order').map((c) => c.args['distribution_company_id']);
    assert.deepEqual(ids, [1, 2]);

    const h2 = harness();
    h2.handlers['create_order'] = () => ok(F.CREATE_ORDER_NO_MARGIN_ERROR);
    const p2 = await prepared(h2, 1);
    const o2 = await h2.run('dropi_confirmar_pedido', { pedido_token: p2.prep['pedido_token'] }, h2.ctx({ currentUserTurn: 2 }));
    assert.ok(typeof o2['error'] === 'string');
    assert.equal(h2.calls.filter((c) => c.tool === 'create_order').length, 1);
    assert.equal(h2.rows.length, 0); // definitive failure: no row kept
    assert.ok(!JSON.stringify(o2).includes('monto a ganar'), 'raw Dropi error must not reach the LLM');

    const h3 = harness();
    h3.handlers['create_order'] = () => ({ content: 'MCP tool execution failed: MCP request timeout: tools/call (30s)', isError: true });
    const p3 = await prepared(h3, 1);
    const o3 = await h3.run('dropi_confirmar_pedido', { pedido_token: p3.prep['pedido_token'] }, h3.ctx({ currentUserTurn: 2 }));
    assert.equal(o3['en_verificacion'], true);
    assert.equal(o3['mensaje'], 'Estamos verificando tu pedido. Puedes consultar su estado más tarde y, si quieres, te conecto con una persona del equipo.');
    assert.equal(o3['ofrecer_asesor'], true);
    assert.equal(h3.calls.filter((c) => c.tool === 'create_order').length, 1);
    assert.equal(h3.rows[0]!.statusLocal, 'desconocido');
    assert.ok(h3.logs.some((l) => l.includes('MANUAL REVIEW')));
  });

  test('logs carry ids only (no name, phone or address)', async () => {
    const h = harness();
    const { prep } = await prepared(h, 1);
    await h.run('dropi_confirmar_pedido', { pedido_token: prep['pedido_token'] }, h.ctx({ currentUserTurn: 2 }));
    const all = h.logs.join('\n');
    for (const pii of ['Ana', 'Pérez', '3174304027', 'Calle 1']) assert.ok(!all.includes(pii), `PII "${pii}" in logs`);
  });
});

const CAP_TEXT = 'En este momento no puedo registrar más pedidos por este medio. Si quieres, te puedo conectar con una persona del equipo para ayudarte.';

describe('one live order per conversation and caps (DS-01/DS-03)', () => {
  const confirm = (h: Harness, token: unknown, over: Partial<DropiSalesContext> = {}) =>
    h.run('dropi_confirmar_pedido', { pedido_token: token }, h.ctx({ currentUserTurn: 9, ...over }));

  test('PoC: 3 prepared summaries + 3 confirmations create ONE order (only the current token)', async () => {
    const h = harness();
    const c = h.ctx({ currentUserTurn: 1 });
    const quote = await quoteFlow(h, c);
    const tokens: unknown[] = [];
    for (let i = 0; i < 3; i++) {
      tokens.push((await h.run('dropi_preparar_pedido', { cotizacion_id: quote['cotizacion_id'], ...BUYER }, c))['pedido_token']);
    }
    await h.endTurn(c);
    const outs = await Promise.all(tokens.map((t) => confirm(h, t)));
    assert.equal(h.calls.filter((x) => x.tool === 'create_order').length, 1);
    assert.equal(outs.filter((o) => o['pedido_creado'] === true).length, 1);
    assert.equal(outs[2]!['pedido_creado'], true); // the last prepared is the live one
    assert.equal(h.rows.length, 1);
    // One quote, one order: the quote is consumed.
    const again = await h.run('dropi_preparar_pedido', { cotizacion_id: quote['cotizacion_id'], ...BUYER }, c);
    assert.match(String(again['error']), /cotización no existe/);
  });

  test('preparing again replaces the previous pending (old token refused)', async () => {
    const h = harness();
    const c = h.ctx({ currentUserTurn: 1 });
    const quote = await quoteFlow(h, c);
    const first = await h.run('dropi_preparar_pedido', { cotizacion_id: quote['cotizacion_id'], ...BUYER }, c);
    const second = await h.run('dropi_preparar_pedido', { cotizacion_id: quote['cotizacion_id'], ...BUYER, barrio: 'Norte' }, c);
    await h.endTurn(c);
    assert.ok((await confirm(h, first['pedido_token']))['error']);
    assert.equal(h.calls.filter((x) => x.tool === 'create_order').length, 0);
    assert.equal((await confirm(h, second['pedido_token']))['pedido_creado'], true);
    assert.equal(h.calls.find((x) => x.tool === 'create_order')!.args['colonia'], 'Norte');
  });

  test('cap per conversation: at most 2 orders in 24 h; 3rd → advisor message, warn and one notification', async () => {
    const h = harness();
    for (let i = 0; i < 2; i++) {
      const { prep } = await (async () => {
        const c = h.ctx({ currentUserTurn: 1 });
        const q = await quoteFlow(h, c);
        const p = await h.run('dropi_preparar_pedido', { cotizacion_id: q['cotizacion_id'], ...BUYER, telefono: `310000000${i}` }, c);
        await h.endTurn(c);
        return { prep: p };
      })();
      assert.equal((await confirm(h, prep['pedido_token']))['pedido_creado'], true);
    }
    for (let i = 0; i < 2; i++) {
      const c = h.ctx({ currentUserTurn: 1 });
      const q = await quoteFlow(h, c);
      const p = await h.run('dropi_preparar_pedido', { cotizacion_id: q['cotizacion_id'], ...BUYER, telefono: `311000000${i}` }, c);
      await h.endTurn(c);
      const out = await confirm(h, p['pedido_token']);
      assert.deepEqual(out, {
        pedido_creado: false,
        mensaje: 'En este momento no puedo registrar más pedidos por este medio. Si quieres, te puedo conectar con una persona del equipo para ayudarte.',
        ofrecer_asesor: true,
      });
    }
    assert.equal(h.calls.filter((x) => x.tool === 'create_order').length, 2);
    assert.equal(h.rows.length, 2);
    assert.deepEqual(h.notices, [{ organizationId: 'org-1', agentId: 'agent-1', reason: 'conversation_cap' }]); // deduplicated
    assert.ok(h.logs.some((l) => l.includes('order cap reached: conversation_cap')));
    assert.ok(!h.logs.join('\n').includes('311000000'), 'phones must not be logged');
  });

  test('cap per buyer phone and agent: 2 in 24 h across conversations', async () => {
    const h = harness();
    const results: unknown[] = [];
    let lastOut: Record<string, unknown> = {};
    for (let i = 0; i < 3; i++) {
      const over = { scopeId: `conv-${i}`, conversationId: `conv-${i}` };
      const { prep } = await prepared(h, 1, over);
      lastOut = await confirm(h, prep['pedido_token'], over);
      results.push(lastOut['pedido_creado']);
    }
    assert.deepEqual(results, [true, true, false]);
    assert.equal(h.notices[0]!.reason, 'phone_cap');
    assert.deepEqual(lastOut, { pedido_creado: false, mensaje: CAP_TEXT, ofrecer_asesor: true });
  });

  test('cap per agent: max_pedidos_diarios ("2 " typed with a space)', async () => {
    const h = harness();
    h.config['max_pedidos_diarios'] = '2 ';
    const results: unknown[] = [];
    let lastOut: Record<string, unknown> = {};
    for (let i = 0; i < 3; i++) {
      const over = { scopeId: `conv-${i}`, conversationId: `conv-${i}` };
      const c = h.ctx({ currentUserTurn: 1, ...over });
      const q = await quoteFlow(h, c);
      const p = await h.run('dropi_preparar_pedido', { cotizacion_id: q['cotizacion_id'], ...BUYER, telefono: `312000000${i}` }, c);
      await h.endTurn(c);
      lastOut = await confirm(h, p['pedido_token'], over);
      results.push(lastOut['pedido_creado']);
    }
    assert.deepEqual(results, [true, true, false]);
    assert.equal(h.notices[0]!.reason, 'agent_cap');
    assert.deepEqual(lastOut, { pedido_creado: false, mensaje: CAP_TEXT, ofrecer_asesor: true });
  });

  test('concurrent confirmations in different conversations respect the phone cap', async () => {
    const h = harness();
    const tokens: Array<{ token: unknown; over: Partial<DropiSalesContext> }> = [];
    for (let i = 0; i < 4; i++) {
      const over = { scopeId: `conv-${i}`, conversationId: `conv-${i}` };
      tokens.push({ token: (await prepared(h, 1, over)).prep['pedido_token'], over });
    }
    const outs = await Promise.all(tokens.map(({ token, over }) => confirm(h, token, over)));
    assert.equal(outs.filter((o) => o['pedido_creado'] === true).length, 2);
    assert.equal(h.calls.filter((x) => x.tool === 'create_order').length, 2);
  });

  test("a 'desconocido' order in the conversation blocks a new one (in verification)", async () => {
    const h = harness();
    h.handlers['create_order'] = () => ({ content: 'MCP tool execution failed: MCP request timeout: tools/call (30s)', isError: true });
    const first = await prepared(h, 1);
    assert.equal((await confirm(h, first.prep['pedido_token']))['en_verificacion'], true);
    // The quote is consumed even when the outcome is unknown.
    const reuse = await h.run('dropi_preparar_pedido', { cotizacion_id: first.quote['cotizacion_id'], ...BUYER }, first.c);
    assert.match(String(reuse['error']), /cotización no existe/);
    h.handlers['create_order'] = () => ok(F.CREATE_ORDER_OK);
    const second = await prepared(h, 1);
    const out = await confirm(h, second.prep['pedido_token']);
    assert.equal(out['pedido_creado'], false);
    assert.equal(out['en_verificacion'], true);
    assert.match(String(out['mensaje']), /anterior está en verificación/);
    assert.equal(out['ofrecer_asesor'], true);
    assert.equal(h.calls.filter((x) => x.tool === 'create_order').length, 1);
  });
});

describe('acceptance of the summary (DS-07)', () => {
  test('a message received before the summary turn finished does not confirm', async () => {
    const h = harness();
    const c = h.ctx({ currentUserTurn: 1 });
    const quote = await quoteFlow(h, c);
    const prep = await h.run('dropi_preparar_pedido', { cotizacion_id: quote['cotizacion_id'], ...BUYER }, c);
    const receivedDuringTurn = h.clock.t - 1;
    await h.endTurn(c);
    const early = await h.run('dropi_confirmar_pedido', { pedido_token: prep['pedido_token'] },
      h.ctx({ currentUserTurn: 2, currentMessageReceivedAt: receivedDuringTurn }));
    assert.equal(early['requiere_confirmacion'], true);
    const unknownTime = await h.run('dropi_confirmar_pedido', { pedido_token: prep['pedido_token'] },
      h.ctx({ currentUserTurn: 2, currentMessageReceivedAt: null }));
    assert.equal(unknownTime['requiere_confirmacion'], true);
    assert.equal(h.calls.filter((x) => x.tool === 'create_order').length, 0);
    const late = await h.run('dropi_confirmar_pedido', { pedido_token: prep['pedido_token'] }, h.ctx({ currentUserTurn: 2 }));
    assert.equal(late['pedido_creado'], true);
  });

  test('summary turn never finished (not stamped) → no confirmation', async () => {
    const h = harness();
    const c = h.ctx({ currentUserTurn: 1 });
    const quote = await quoteFlow(h, c);
    const prep = await h.run('dropi_preparar_pedido', { cotizacion_id: quote['cotizacion_id'], ...BUYER }, c);
    h.clock.t += 5000; // turn crashed before saving the assistant message: no endTurn
    const out = await h.run('dropi_confirmar_pedido', { pedido_token: prep['pedido_token'] }, h.ctx({ currentUserTurn: 2 }));
    assert.equal(out['requiere_confirmacion'], true);
    // A later turn that did not prepare it does not stamp it either.
    await h.endTurn(h.ctx({ currentUserTurn: 2 }));
    const out2 = await h.run('dropi_confirmar_pedido', { pedido_token: prep['pedido_token'] }, h.ctx({ currentUserTurn: 3 }));
    assert.equal(out2['requiere_confirmacion'], true);
  });

  test('the last buyer message must be an affirmation without negation', async () => {
    const h = harness();
    const { prep } = await (async () => {
      const c = h.ctx({ currentUserTurn: 1 });
      const q = await quoteFlow(h, c);
      const p = await h.run('dropi_preparar_pedido', { cotizacion_id: q['cotizacion_id'], ...BUYER }, c);
      await h.endTurn(c);
      return { prep: p };
    })();
    for (const text of ['sí pero cambia la dirección', 'mejor no', '¿y cuánto demora?']) {
      const r = await h.run('dropi_confirmar_pedido', { pedido_token: prep['pedido_token'] }, h.ctx({ currentUserTurn: 2, lastBuyerMessage: text }));
      assert.equal(r['requiere_confirmacion'], true, text);
    }
    assert.equal(h.calls.filter((x) => x.tool === 'create_order').length, 0);
    const yes = await h.run('dropi_confirmar_pedido', { pedido_token: prep['pedido_token'] }, h.ctx({ currentUserTurn: 2, lastBuyerMessage: 'Dale, de una' }));
    assert.equal(yes['pedido_creado'], true);
  });
});

describe('neutral messages never promise a proactive contact', () => {
  test('no "te contactará" / "te confirmaremos" / "te escribiremos" in any message', async () => {
    const { MSG } = await import('./service');
    for (const [key, text] of Object.entries(MSG)) {
      assert.ok(!/contactar[aá]n?\b|te contactar|confirmaremos|te escribiremos|te llamaremos|te avisaremos/i.test(text), `${key}: ${text}`);
    }
  });
});

describe('widget metadata (DS-06)', () => {
  test('toolTrace and other engine keys never reach the widget', () => {
    const out = sanitizeWidgetMessageMetadata({
      toolTrace: [{ calls: [{ name: 'custom_fn', args: { token: 'x' }, result: '{"secret":1}' }] }],
      toolsCalled: ['dropi_buscar_productos'],
      tokensUsed: 10,
      model: 'm',
      latencyMs: 1,
      intermediate: true,
      cart_action: { type: 'add' },
    });
    assert.deepEqual(out, { intermediate: true, cart_action: { type: 'add' } });
    assert.ok(!JSON.stringify(out).includes('secret'));
  });
});

describe('isolation between conversations (fakes)', () => {
  test('products, quotes and tokens of another conversation are rejected', async () => {
    const h = harness();
    const a = h.ctx({ scopeId: 'conv-A', conversationId: 'conv-A', currentUserTurn: 1 });
    const b = h.ctx({ scopeId: 'conv-B', conversationId: 'conv-B', currentUserTurn: 9 });
    const quote = await quoteFlow(h, a);
    assert.match(String((await h.run('dropi_cotizar_envio', { producto_id: 101, cantidad: 1, ciudad: 'Cajica' }, b))['error']), /Busca el producto/);
    assert.match(String((await h.run('dropi_preparar_pedido', { cotizacion_id: quote['cotizacion_id'], ...BUYER }, b))['error']), /cotización no existe/);
    const prep = await h.run('dropi_preparar_pedido', { cotizacion_id: quote['cotizacion_id'], ...BUYER }, a);
    assert.match(String((await h.run('dropi_confirmar_pedido', { pedido_token: prep['pedido_token'] }, b))['error']), /no existe/);
    assert.equal(h.calls.filter((c) => c.tool === 'create_order').length, 0);
  });

  test('a stored object with another scope is rejected even under the right key', async () => {
    const h = harness();
    const a = h.ctx();
    const quote = await quoteFlow(h, a);
    const key = `dropi:quote:conv-1:${String(quote['cotizacion_id'])}`;
    const raw = JSON.parse((await h.deps.kv.get(key))!) as Record<string, unknown>;
    await h.deps.kv.set(key, JSON.stringify({ ...raw, scope: 'conv-X' }), 60);
    assert.ok((await h.run('dropi_preparar_pedido', { cotizacion_id: quote['cotizacion_id'], ...BUYER }, a))['error']);
  });
});

describe('order tracking (fakes)', () => {
  async function withOrder(h: Harness, over: Partial<DropiSalesContext>, buyer: Record<string, unknown> = BUYER) {
    const c = h.ctx({ ...over, currentUserTurn: 1 });
    const quote = await quoteFlow(h, c);
    const prep = await h.run('dropi_preparar_pedido', { cotizacion_id: quote['cotizacion_id'], ...buyer }, c);
    await h.endTurn(c);
    const out = await h.run('dropi_confirmar_pedido', { pedido_token: prep['pedido_token'] }, h.ctx({ ...over, currentUserTurn: 2 }));
    assert.equal(out['pedido_creado'], true);
  }

  test('own orders without a number: trimmed, with carrier and no customer data', async () => {
    const h = harness();
    await withOrder(h, {});
    const out = await h.run('dropi_estado_pedido', {}, h.ctx());
    const pedidos = out['pedidos'] as Array<Record<string, unknown>>;
    assert.equal(pedidos.length, 1);
    assert.equal(pedidos[0]!['numero_pedido'], '96972142');
    assert.equal(pedidos[0]!['transportadora'], 'ENVIA');
    const text = JSON.stringify(out);
    assertNoForbiddenKeys(text);
    for (const pii of ['Ana', 'Pérez', '3174304027', '1020304050', 'Calle 1', 'Otro Cliente']) assert.ok(!text.includes(pii), `PII "${pii}" leaked`);
    const lo = h.calls.find((c) => c.tool === 'list_orders')!.args;
    assert.deepEqual(lo, { text_to_search: '96972142', from: '2026-11-10', until: '2026-11-15', result_number: 5 });
  });

  test('order of another conversation or agent is not returned without phone verification', async () => {
    const h = harness();
    h.handlers['get_order'] = () => ok({ ...F.GET_ORDER, tracking_code: 'GUIA-777' });
    await withOrder(h, {});
    // Own (same conversation): the tracking code is included.
    const own = await h.run('dropi_estado_pedido', { numero_pedido: '96972142' }, h.ctx());
    assert.equal((own['pedidos'] as Array<Record<string, unknown>>)[0]!['guia'], 'GUIA-777');
    // Another conversation on the web: needs the phone.
    const other = h.ctx({ scopeId: 'conv-2', conversationId: 'conv-2', contactId: 'contact-2' });
    assert.deepEqual(await h.run('dropi_estado_pedido', {}, other), {
      pedidos: [],
      mensaje: 'No encontré pedidos de este cliente. Pide su número de pedido y el teléfono con el que lo hizo.',
    });
    assert.match(String((await h.run('dropi_estado_pedido', { numero_pedido: '96972142' }, other))['error']), /teléfono/);
    assert.equal((await h.run('dropi_estado_pedido', { numero_pedido: '96972142', telefono: '3000000000' }, other))['error'], 'No encontré un pedido con esos datos');
    // Another agent: own orders are per agent.
    const otherAgent = h.ctx({ agentId: 'agent-2' });
    assert.deepEqual((await h.run('dropi_estado_pedido', {}, otherAgent))['pedidos'], []);
    // Right phone → allowed, still trimmed.
    const verified = await h.run('dropi_estado_pedido', { numero_pedido: '96972142', telefono: '317 430 4027' }, other);
    const vp = verified['pedidos'] as Array<Record<string, unknown>>;
    assert.equal(vp.length, 1);
    // Verified but not own: status, products, total and carrier — no tracking code (DS-05).
    assert.equal(vp[0]!['guia'], undefined);
    assert.equal(vp[0]!['estado'], 'PENDIENTE');
    assert.equal(vp[0]!['transportadora'], 'ENVIA');
    assert.ok(!JSON.stringify(verified).includes('GUIA-777'));
    assertNoForbiddenKeys(JSON.stringify(verified));
  });

  test('DS-04: a contact shared between conversations does not give access (web)', async () => {
    const h = harness();
    await withOrder(h, { scopeId: 'conv-victim', conversationId: 'conv-victim', contactId: 'contact-shared' });
    const attacker = h.ctx({ scopeId: 'conv-attacker', conversationId: 'conv-attacker', contactId: 'contact-shared' });
    assert.deepEqual((await h.run('dropi_estado_pedido', {}, attacker))['pedidos'], []);
    assert.match(String((await h.run('dropi_estado_pedido', { numero_pedido: '96972142' }, attacker))['error']), /teléfono/);
    // Same contact on WhatsApp (contact merged by phone) with another wa_from: no access either.
    const waAttacker = h.ctx({ channel: 'whatsapp', waFrom: '573009999999', scopeId: 'conv-wa-x', conversationId: 'conv-wa-x', contactId: 'contact-shared' });
    assert.deepEqual((await h.run('dropi_estado_pedido', {}, waAttacker))['pedidos'], []);
  });

  test('preview: own orders are those of the same preview session', async () => {
    const h = harness();
    const pv = { scopeId: 'ps-1', conversationId: null, previewSessionId: 'ps-1', contactId: null, channel: 'preview' };
    await withOrder(h, pv);
    assert.equal(h.rows[0]!.previewSessionId, 'ps-1');
    assert.equal(h.rows[0]!.ownerWaLast10, null);
    assert.equal(((await h.run('dropi_estado_pedido', {}, h.ctx(pv)))['pedidos'] as unknown[]).length, 1);
    const pv2 = { ...pv, scopeId: 'ps-2', previewSessionId: 'ps-2' };
    assert.deepEqual((await h.run('dropi_estado_pedido', {}, h.ctx(pv2)))['pedidos'], []);
  });

  test('missing order and wrong phone give the same message', async () => {
    const h = harness();
    h.handlers['get_order'] = () => ok({ error: { code: 4, message: 'Orden no encontrada' } });
    const c = h.ctx({ contactId: null });
    const missing = await h.run('dropi_estado_pedido', { numero_pedido: '93204655', telefono: '3174304027' }, c);
    h.handlers['get_order'] = () => ok(F.GET_ORDER);
    const wrong = await h.run('dropi_estado_pedido', { numero_pedido: '96972142', telefono: '3110000000' }, c);
    assert.deepEqual(missing, wrong);
  });

  test('WhatsApp: verified with wa_from, no arguments needed', async () => {
    const h = harness();
    const wa = h.ctx({ channel: 'whatsapp', waFrom: '573174304027', contactId: 'contact-wa', scopeId: 'conv-wa', conversationId: 'conv-wa' });
    // Order not in dropi_orders: verified against wa_from (573174304027 → 3174304027).
    const out = await h.run('dropi_estado_pedido', { numero_pedido: '96972142' }, wa);
    assert.equal((out['pedidos'] as unknown[]).length, 1);
    // A phone in the arguments is ignored on WhatsApp.
    h.handlers['get_order'] = () => ok({ ...F.GET_ORDER, customer: { ...F.GET_ORDER.customer, phone: '3110000000' } });
    const spoof = await h.run('dropi_estado_pedido', { numero_pedido: '96972142', telefono: '3110000000' }, wa);
    assert.equal(spoof['error'], 'No encontré un pedido con esos datos');
  });

  test('DS-02 PoC: overwriting contacts.phone (capture_variable) no longer gives access on WhatsApp', async () => {
    const h = harness();
    // Victim orders from WhatsApp: owner_wa_last10 = their Meta number.
    await withOrder(h, { channel: 'whatsapp', waFrom: '573174304027', scopeId: 'conv-v', conversationId: 'conv-v', contactId: 'contact-v' });
    assert.equal(h.rows[0]!.ownerWaLast10, '3174304027');
    // Attacker on WhatsApp sets contacts.phone = victim's phone via capture_variable. The sales
    // service never reads contacts.phone (OrdersRepository has no such method): identity = wa_from.
    const attacker = h.ctx({ channel: 'whatsapp', waFrom: '573001112233', scopeId: 'conv-a', conversationId: 'conv-a', contactId: 'contact-a' });
    assert.deepEqual((await h.run('dropi_estado_pedido', {}, attacker))['pedidos'], []);
    assert.equal((await h.run('dropi_estado_pedido', { numero_pedido: '96972142' }, attacker))['error'], 'No encontré un pedido con esos datos');
    // The phone argument is ignored on WhatsApp.
    assert.equal((await h.run('dropi_estado_pedido', { numero_pedido: '96972142', telefono: '3174304027' }, attacker))['error'], 'No encontré un pedido con esos datos');
    // The victim still sees it from a new WhatsApp conversation.
    const victim2 = h.ctx({ channel: 'whatsapp', waFrom: '573174304027', scopeId: 'conv-v2', conversationId: 'conv-v2', contactId: 'contact-other' });
    assert.equal(((await h.run('dropi_estado_pedido', {}, victim2))['pedidos'] as unknown[]).length, 1);
  });

  test('WhatsApp without wa_from behaves as web (conversation + phone argument)', async () => {
    const h = harness();
    const wa = h.ctx({ channel: 'whatsapp', waFrom: null, contactId: 'contact-wa', scopeId: 'conv-old', conversationId: 'conv-old' });
    assert.match(String((await h.run('dropi_estado_pedido', { numero_pedido: '96972142' }, wa))['error']), /teléfono/);
    assert.equal(((await h.run('dropi_estado_pedido', { numero_pedido: '96972142', telefono: '3174304027' }, wa))['pedidos'] as unknown[]).length, 1);
  });

  test('DS-05: verified lookups are limited per agent (30/h) across new sessions', async () => {
    const h = harness();
    for (let i = 0; i < 30; i++) {
      const c = h.ctx({ scopeId: `conv-${i}`, conversationId: `conv-${i}` });
      const r = await h.run('dropi_estado_pedido', { numero_pedido: String(93204600 + i), telefono: `31100000${String(i).padStart(2, '0')}` }, c);
      assert.equal(r['error'], 'No encontré un pedido con esos datos');
    }
    const fresh = h.ctx({ scopeId: 'conv-new', conversationId: 'conv-new' });
    const limited = await h.run('dropi_estado_pedido', { numero_pedido: '93204699', telefono: '3119999999' }, fresh);
    assert.match(String(limited['error']), /límite/);
    assert.equal(h.calls.filter((x) => x.tool === 'get_order').length, 30);
    assert.ok(h.logs.some((l) => l.includes('agent limit')));
    // Another agent is not affected.
    const other = h.ctx({ agentId: 'agent-2', scopeId: 'conv-z', conversationId: 'conv-z' });
    assert.equal((await h.run('dropi_estado_pedido', { numero_pedido: '93204699', telefono: '3119999999' }, other))['error'], 'No encontré un pedido con esos datos');
  });

  test('DS-05: verified lookups are limited per agent and target phone (5/h) across new sessions', async () => {
    const h = harness();
    for (let i = 0; i < 5; i++) {
      const c = h.ctx({ scopeId: `conv-${i}`, conversationId: `conv-${i}` });
      await h.run('dropi_estado_pedido', { numero_pedido: String(93204600 + i), telefono: '3174304027' }, c);
    }
    const c6 = h.ctx({ scopeId: 'conv-6', conversationId: 'conv-6' });
    assert.match(String((await h.run('dropi_estado_pedido', { numero_pedido: '96972142', telefono: '3174304027' }, c6))['error']), /límite/);
    // A different target phone still works.
    assert.equal((await h.run('dropi_estado_pedido', { numero_pedido: '96972142', telefono: '3000000001' }, c6))['error'], 'No encontré un pedido con esos datos');
  });

  test('rate limit: 5 lookups per order number per conversation and hour', async () => {
    const h = harness();
    const c = h.ctx({ contactId: null });
    for (let i = 0; i < 5; i++) {
      const r = await h.run('dropi_estado_pedido', { numero_pedido: '93204655', telefono: '3110000000' }, c);
      assert.equal(r['error'], 'No encontré un pedido con esos datos');
    }
    const limited = await h.run('dropi_estado_pedido', { numero_pedido: '93204655', telefono: '3110000000' }, c);
    assert.match(String(limited['error']), /límite/);
    assert.equal(h.calls.filter((x) => x.tool === 'get_order').length, 5);
  });

  test('invalid order number is rejected before any call', async () => {
    const h = harness();
    const r = await h.run('dropi_estado_pedido', { numero_pedido: '12ab' }, h.ctx());
    assert.ok(r['error']);
    assert.equal(h.calls.length, 0);
  });
});
