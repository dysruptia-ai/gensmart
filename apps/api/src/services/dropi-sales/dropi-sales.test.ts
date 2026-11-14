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
} from './core';
import type { DropiOrderRecord, DropiSalesContext, DropiSalesDeps, McpCallResult, NewOrderRow, OwnerFilter } from './service';
import { executeDropiSalesTool, mcpToolExposure, requiresSelectedTools, dropiSalesToolDefinitions, type DropiSalesToolName } from './tools';
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

  test('ownership: same agent and contact, or WhatsApp phone', () => {
    const row = { agentId: 'A', contactId: 'C1', buyerPhoneLast10: '3174304027' };
    assert.equal(ownsOrder(row, { agentId: 'A', contactId: 'C1', channel: 'web', contactPhoneLast10: null }), true);
    assert.equal(ownsOrder(row, { agentId: 'B', contactId: 'C1', channel: 'web', contactPhoneLast10: null }), false);
    assert.equal(ownsOrder(row, { agentId: 'A', contactId: 'C2', channel: 'web', contactPhoneLast10: '3174304027' }), false);
    assert.equal(ownsOrder(row, { agentId: 'A', contactId: 'C2', channel: 'whatsapp', contactPhoneLast10: '3174304027' }), true);
    assert.equal(ownsOrder(row, { agentId: 'B', contactId: 'C2', channel: 'whatsapp', contactPhoneLast10: '3174304027' }), false);
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
  handlers: Record<string, (args: Record<string, unknown>) => McpCallResult>;
  ctx: (over?: Partial<DropiSalesContext>) => DropiSalesContext;
  run: (name: DropiSalesToolName, args: Record<string, unknown>, ctx: DropiSalesContext) => Promise<Record<string, unknown>>;
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
  const owns = (r: NewOrderRow, o: OwnerFilter) =>
    r.agentId === o.agentId && r.organizationId === o.organizationId &&
    ((r.contactId !== null && r.contactId === o.contactId) || (o.phoneLast10 !== null && r.buyerPhoneLast10 === o.phoneLast10));
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
      insertPending: async (row) => {
        rows.push({ ...row, externalOrderId: null, statusLocal: 'desconocido', statusCached: null, createdAt: '2026-11-10T19:03:22Z' });
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
      findOwnRecent: async (o, limit) => rows.filter((r) => owns(r, o)).slice(0, limit),
      findOwnByNumber: async (o, n) => rows.find((r) => owns(r, o) && r.externalOrderId === n) ?? null,
      updateStatusCached: async () => {},
      contactPhone: async (contactId) => (contactId === 'contact-wa' ? '573174304027' : null),
    },
    loadMarginPercent: async () => 20,
    log: { info: (m) => logs.push(m), warn: (m) => logs.push(m), error: (m) => logs.push(m) },
    randomId: () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`,
    now: () => new Date('2026-11-14T12:00:00Z'),
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
    contactId: 'contact-1',
    channel: 'web',
    currentUserTurn: 1,
    ...over,
  });
  const run: Harness['run'] = async (name, args, c) =>
    JSON.parse(await executeDropiSalesTool(name, args, c, deps)) as Record<string, unknown>;
  return { deps, calls, rows, logs, handlers, ctx, run };
}

const BUYER = { nombre: 'Ana', apellido: 'Pérez', direccion: 'Calle 1 # 2-3', telefono: '+57 317 430 4027', barrio: 'Centro' };

async function quoteFlow(h: Harness, c: DropiSalesContext): Promise<Record<string, unknown>> {
  await h.run('dropi_buscar_productos', { busqueda: 'Rompecabezas' }, c);
  return h.run('dropi_cotizar_envio', { producto_id: 101, cantidad: 1, ciudad: 'Cajicá' }, c);
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
    h.deps.loadMarginPercent = async () => 0; // price 29 200 vs supplier 14 900: still positive
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
  async function prepared(h: Harness, turn: number) {
    const c = h.ctx({ currentUserTurn: turn });
    const quote = await quoteFlow(h, c);
    const prep = await h.run('dropi_preparar_pedido', { cotizacion_id: quote['cotizacion_id'], ...BUYER }, c);
    return { quote, prep };
  }

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
    assert.equal(o3['mensaje'], 'Estamos verificando tu pedido; te confirmaremos en breve.');
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
  async function withOrder(h: Harness, over: Partial<DropiSalesContext>) {
    const c = h.ctx({ ...over, currentUserTurn: 1 });
    const quote = await quoteFlow(h, c);
    const prep = await h.run('dropi_preparar_pedido', { cotizacion_id: quote['cotizacion_id'], ...BUYER }, c);
    await h.run('dropi_confirmar_pedido', { pedido_token: prep['pedido_token'] }, { ...c, currentUserTurn: 2 });
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

  test('order of another contact or agent is not returned without phone verification', async () => {
    const h = harness();
    await withOrder(h, {});
    // Another contact on the web: needs the phone.
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
    assert.equal((verified['pedidos'] as unknown[]).length, 1);
    assertNoForbiddenKeys(JSON.stringify(verified));
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

  test('WhatsApp: verified with the contact phone, no arguments needed', async () => {
    const h = harness();
    const wa = h.ctx({ channel: 'whatsapp', contactId: 'contact-wa', scopeId: 'conv-wa', conversationId: 'conv-wa' });
    // Order not in dropi_orders: verified against contacts.phone (573174304027 → 3174304027).
    const out = await h.run('dropi_estado_pedido', { numero_pedido: '96972142' }, wa);
    assert.equal((out['pedidos'] as unknown[]).length, 1);
    // A phone in the arguments is ignored on WhatsApp.
    h.handlers['get_order'] = () => ok({ ...F.GET_ORDER, customer: { ...F.GET_ORDER.customer, phone: '3110000000' } });
    const spoof = await h.run('dropi_estado_pedido', { numero_pedido: '96972142', telefono: '3110000000' }, wa);
    assert.equal(spoof['error'], 'No encontré un pedido con esos datos');
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
