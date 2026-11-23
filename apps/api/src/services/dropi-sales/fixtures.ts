/**
 * Test fixtures for the Dropi sales toolkit.
 *
 * The Dropi MCP (dropi-mcp 0.1.0, protocol 2025-06-18) answers with ONE `text` block in TOON
 * (Token-Oriented Object Notation): no structuredContent, no outputSchema, no format parameter.
 * Errors come as plain text with isError=true (never `{error:{message}}`).
 *
 * REAL_* fixtures are real responses captured from Dropi in production on 2026-11-17, as strings.
 * Rows / variations were trimmed in some of them (the [N] headers and `count` were updated: strict
 * TOON checks them). get_order / list_orders carry FICTITIOUS buyer data (name, phone, address).
 *
 * The flow fixtures used by the service harness (catalog with ids 101/202/303/404, parametrized
 * quote) are synthetic values written in the same real TOON shape, so the orchestration tests keep
 * their known numbers. JSON_* fixtures keep the JSON path of each parser covered.
 */

export interface FixtureResult {
  content: string;
  isError: boolean;
}

const lines = (...rows: string[]): string => rows.join('\n');

// ── Real responses (TOON) ────────────────────────────────────────────────────

/** list_products {"search":"sabana"}: variable products. Product stock/suggested_price are useless
 * (0 and 79); the real values are per variation. Second product trimmed to 2 of 10 variations. */
export const REAL_LIST_PRODUCTS_SABANA = lines(
  'items[2]:',
  '  - id: 1919960',
  '    sku: null',
  '    name: SABANA 800 HILOS - VINOTINTO',
  '    sale_price: 30000',
  '    suggested_price: 0',
  '    simple_price: 30000',
  '    visible_start_sale_price: 30000',
  '    visible_end_sale_price: 40000',
  '    combo_min_sale_price: 0',
  '    combo_min_suggested_price: 0',
  '    stock: 0',
  '    supplier_id: 37384',
  '    categories[1]: Hogar',
  '    gallery[1]{urlS3}:',
  '      "https://d39ru7awumhhs2.cloudfront.net/colombia/products/1919960/1757350386Captura%20de%20pantalla%202025-09-08%20a%20la(s)%2011.51.12%20a.m..png"',
  '    variations[5]:',
  '      - id: 1714552',
  '        sku: "-0"',
  '        stock: 1000',
  '        sale_price: 40000',
  '        suggested_price: 80000',
  '        attributes[1]{name,value}:',
  '          TALLA,KING',
  '      - id: 1714553',
  '        sku: "-1"',
  '        stock: 1000',
  '        sale_price: 40000',
  '        suggested_price: 80000',
  '        attributes[1]{name,value}:',
  '          TALLA,QUEEN',
  '      - id: 1714554',
  '        sku: "-2"',
  '        stock: 999',
  '        sale_price: 30000',
  '        suggested_price: 60000',
  '        attributes[1]{name,value}:',
  '          TALLA,DOBLE',
  '      - id: 1714555',
  '        sku: "-3"',
  '        stock: 1000',
  '        sale_price: 30000',
  '        suggested_price: 60000',
  '        attributes[1]{name,value}:',
  '          TALLA,SEMIDOBLE',
  '      - id: 1714556',
  '        sku: "-4"',
  '        stock: 1000',
  '        sale_price: 30000',
  '        suggested_price: 60000',
  '        attributes[1]{name,value}:',
  '          TALLA,SENCILLA',
  '  - id: 1969814',
  '    sku: "0000012"',
  '    name: JUEGO DE SABANAS',
  '    sale_price: 59000',
  '    suggested_price: 79',
  '    simple_price: 59000',
  '    visible_start_sale_price: 59000',
  '    visible_end_sale_price: 59000',
  '    combo_min_sale_price: 0',
  '    combo_min_suggested_price: 0',
  '    stock: 0',
  '    supplier_id: 657651',
  '    categories[1]: Hogar',
  '    gallery[1]{urlS3}:',
  '      "https://d39ru7awumhhs2.cloudfront.net/colombia/products/1969814/1761143180ChatGPT%20Image%208%20oct%202025,%2023_40_24.png"',
  '    variations[2]:',
  '      - id: 1801932',
  '        sku: 0000012-0',
  '        stock: 10',
  '        sale_price: 59000',
  '        suggested_price: 79000',
  '        attributes[1]{name,value}:',
  '          COLOR,ROJO',
  '      - id: 1801933',
  '        sku: 0000012-1',
  '        stock: 10',
  '        sale_price: 59000',
  '        suggested_price: 79000',
  '        attributes[1]{name,value}:',
  '          COLOR,NEGRO',
  'count: 2',
  'currency: COP'
);

/** list_products {"search":"rompecabezas"}: simple products (`variations[0]:`). */
export const REAL_LIST_PRODUCTS_ROMPECABEZAS = lines(
  'items[2]:',
  '  - id: 1912391',
  '    sku: "77182828"',
  '    name: Rompecabezas En Madera Tematico Aprendiz',
  '    sale_price: 14900',
  '    suggested_price: 17900',
  '    simple_price: 14900',
  '    visible_start_sale_price: null',
  '    visible_end_sale_price: null',
  '    combo_min_sale_price: 0',
  '    combo_min_suggested_price: 0',
  '    stock: 100',
  '    supplier_id: 12108',
  '    categories[1]: Jugueteria',
  '    gallery[1]{urlS3}:',
  '      "https://d39ru7awumhhs2.cloudfront.net/colombia/products/1912391/1756648022a3481b_e412874b802d476bb8ae1725c505822e~mv2.jpg"',
  '    variations[0]:',
  '  - id: 1932997',
  '    sku: fgbnff',
  '    name: Rompecabezas Profesion Oficio Aprende Co',
  '    sale_price: 22900',
  '    suggested_price: 27900',
  '    simple_price: 22900',
  '    visible_start_sale_price: null',
  '    visible_end_sale_price: null',
  '    combo_min_sale_price: 0',
  '    combo_min_suggested_price: 0',
  '    stock: 100',
  '    supplier_id: 12108',
  '    categories[1]: Jugueteria',
  '    gallery[1]{urlS3}:',
  '      "https://d39ru7awumhhs2.cloudfront.net/colombia/products/1932997/175845395910.jpg"',
  '    variations[0]:',
  'count: 2',
  'currency: COP'
);

/** list_carriers {} (complete). */
export const LIST_CARRIERS = lines(
  'items[10]{id,name}:',
  '  2,ENVIA',
  '  3,INTERRAPIDISIMO',
  '  4,DOMINA',
  '  5,COORDINADORA',
  '  6,VELOCES',
  '  7,99MINUTOS',
  '  10,TCC',
  '  13,JAMV-DRIVE',
  '  17,WIILOG',
  '  14,DEROCHA-EXPRESS',
  'count: 10'
);

/** list_departments {} (complete). */
export const LIST_DEPARTMENTS = lines(
  'items[33]{id,country_id,name,department_code}:',
  '  1,1,META,"50"',
  '  3,1,CUNDINAMARCA,"25"',
  '  4,1,CESAR,"20"',
  '  5,1,CALDAS,"17"',
  '  7,1,CASANARE,"85"',
  '  8,1,SANTANDER,"68"',
  '  9,1,LA GUAJIRA,"44"',
  '  11,1,TOLIMA,"73"',
  '  12,1,VALLE,"76"',
  '  13,1,ANTIOQUIA,"05"',
  '  15,1,BOYACA,"15"',
  '  16,1,MAGDALENA,"47"',
  '  17,1,NORTE DE SANTANDER,"54"',
  '  18,1,BOLIVAR,"13"',
  '  19,1,QUINDIO,"63"',
  '  20,1,CORDOBA,"23"',
  '  21,1,RISARALDA,"66"',
  '  22,1,ATLANTICO,"08"',
  '  28,1,CAUCA,"19"',
  '  34,1,SUCRE,"70"',
  '  38,1,CAQUETA,"18"',
  '  39,1,ARAUCA,""',
  '  40,1,NARIÑO,"52"',
  '  49,1,HUILA,"41"',
  '  51,1,GUAVIARE,""',
  '  54,1,CHOCO,""',
  '  64,1,VAUPES,""',
  '  67,1,PUTUMAYO,"86"',
  '  70,1,VICHADA,""',
  '  81,1,AMAZONAS,""',
  '  91,1,ARCHIPIELAGO DE SAN ANDRES,"88"',
  '  92,1,GUAINIA,""',
  '  94,1,GUAJIRA,""',
  'count: 33'
);

/** list_categories {}: first 10 of 30 rows. */
export const LIST_CATEGORIES = lines(
  'items[10]{id,name,parent_category}:',
  '  1247,Bisutería,0',
  '  1248,Ropa Deportiva,0',
  '  1252,Vaporizadores,0',
  '  2,Mascotas,0',
  '  3,Moda,0',
  '  4,Tecnologia,0',
  '  6,Cocina,0',
  '  7,Belleza,0',
  '  8,Salud,0',
  '  1,Hogar,0',
  'count: 10'
);

/** search_cities {"name":"CAJICA"}: one city (8-digit cod_dane, empty zip_code). */
export const SEARCH_CITIES_CAJICA = lines(
  'items[1]{id,department_id,name,cod_dane,zip_code}:',
  '  70,3,CAJICA,"25126000",""',
  'count: 1'
);

/** search_cities {"name":"SAN JOSE"}: partial matches; trimmed to 6 of 13 rows. */
export const REAL_SEARCH_CITIES_SAN_JOSE = lines(
  'items[6]{id,department_id,name,cod_dane,zip_code}:',
  '  399,15,SAN JOSE DE PARE,"15664000",""',
  '  1044,5,SAN JOSE (C),"17665000",""',
  '  1046,13,SAN JOSE DE LA MONTAÑA,"05658000",""',
  '  1361,13,SAN JOSE DEL NUS (SAN JOSE DE NUESTRA SEÑORA),"05425005",""',
  '  1468,21,SAN JOSE,"66001020",""',
  '  1558,54,SAN JOSE DEL PALMAR,"27660000",""',
  'count: 6'
);

/** quote_shipping to Cajicá (rompecabezas 1912391, price 21 500, cash on delivery). */
export const REAL_QUOTE_CAJICA = lines(
  'carriers[10]{carrier,service,shipping_cost,insurance,trajectory,error}:',
  '  ENVIA,normal,12758,null,URBANO,null',
  '  INTERRAPIDISIMO,normal,null,null,"",Esta transportadora solo acepta envíos con pago contra entrega desde $45.000 COP.',
  '  DOMINA,normal,15081.4,null,Urbano,null',
  '  COORDINADORA,normal,14475,null,"",null',
  '  VELOCES,normal,null,null,"",La transportadora no está disponible para este envío.',
  '  99MINUTOS,normal,null,null,"",La transportadora no ofrece pago contra entrega en esta ciudad.',
  '  TCC,normal,14497.5,607.5,URBANO,null',
  '  JAMV-DRIVE,normal,19000,null,"",null',
  '  WIILOG,normal,null,null,"",La transportadora no está disponible para este envío.',
  '  DEROCHA-EXPRESS,normal,22400,null,"",null',
  'count: 10',
  'currency: COP'
);

/** Fictitious buyer data (the real capture had the tester's own data). */
export const FAKE_BUYER = { name: 'Ana Pérez', phone: '3001234567', address: 'Calle 1 # 2-3' };

/** get_order {"id":"96972142"} in the real shape (ISO created_at), with fictitious buyer data. */
export function getOrder(over: { phone?: string; trackingCode?: string } = {}): string {
  return lines(
    'order_id: "96972142"',
    'status: CANCELADO',
    'customer:',
    `  name: ${FAKE_BUYER.name}`,
    `  phone: "${over.phone ?? FAKE_BUYER.phone}"`,
    '  document: ""',
    `  address: ${FAKE_BUYER.address}`,
    '  city: CAJICA',
    'items[1]{product_id,product_name,qty,unit_price,subtotal}:',
    '  1912380,Rompecabezas En Madera Tematico Aprendiz,1,35000,35000',
    'total: 35000',
    'currency: COP',
    'payment_method: ""',
    'created_at: "2026-11-14T14:39:45"',
    'updated_at: "2026-11-17T21:29:43.519Z"',
    ...(over.trackingCode ? [`tracking_code: ${over.trackingCode}`] : [])
  );
}

export const GET_ORDER = getOrder();

/** list_orders {"text_to_search":"96972142",…} in the real shape, with fictitious buyer data. */
export const LIST_ORDERS = lines(
  'items[1]{order_id,status,customer_name,customer_phone,city,total,currency,payment_method,shipping_company,rate_type,created_at}:',
  `  "96972142",CANCELADO,${FAKE_BUYER.name},"${FAKE_BUYER.phone}",CAJICA,35000,COP,"",ENVIA,CON RECAUDO,"2026-11-14T14:39:45"`,
  'count: 1',
  'applied_range:',
  '  from: 2026-11-14',
  '  until: 2026-11-16',
  '  defaulted: false'
);

/** Real error results: plain text with isError=true. */
export const ERROR_ORDER_NOT_FOUND: FixtureResult = { content: 'core failed for country CO', isError: true };
export const ERROR_SCHEMA: FixtureResult = {
  content: 'validating "arguments": validating root: validating /properties/destination_city: required: missing properties: ["zip_code"]',
  isError: true,
};

// ── create_order (no real sample yet) ────────────────────────────────────────

/**
 * There is no real successful create_order sample yet. This is the previous JSON fixture object
 * `{ order_id: '96972142', status: 'PENDIENTE', total: 35000, currency: 'COP',
 * created_at: '2026-11-10 14:03:22' }` encoded with `encode()` of @toon-format/toon 2.3.1 (the
 * library Dropi's encoder follows). To be validated in the E2E test: a different shape ends as
 * `unknown` (manual review), never as a duplicate order.
 */
export const CREATE_ORDER_OK = lines(
  'order_id: "96972142"',
  'status: PENDIENTE',
  'total: 35000',
  'currency: COP',
  'created_at: "2026-11-10 14:03:22"'
);

/** Rejections: plain text with isError=true (same messages as before). */
export const CREATE_ORDER_CARRIER_ERROR: FixtureResult = {
  content: 'La ciudad no tiene habilitado el médoto de envío: CON RECAUDO - CAJICA-CUNDINAMARCA-DEROCHA-EXPRESS-[]',
  isError: true,
};

export const CREATE_ORDER_NO_MARGIN_ERROR: FixtureResult = {
  content: 'No puede continuar, ya que el monto a ganar es menor o igual a cero(0)',
  isError: true,
};

// ── Flow fixtures (synthetic values, real TOON shape) ────────────────────────

/**
 * Catalog for the orchestration tests: 101 simple (stock 12), 202 variable with product stock 0 and
 * suggested_price 0 (real quirk) and 3 variations (one without stock), 303 sold out, 404 without a
 * suggested price.
 */
export function listProducts(over: { currency?: string; rmpSalePrice?: number } = {}): string {
  return lines(
    'items[4]:',
    '  - id: 101',
    '    sku: RMP-500',
    '    name: Rompecabezas 500 piezas',
    `    sale_price: ${over.rmpSalePrice ?? 14900}`,
    '    suggested_price: 29166',
    '    simple_price: 15500',
    '    stock: 12',
    '    supplier_id: 777',
    '    categories[1]: Juguetes',
    '    gallery[1]{urlS3}:',
    '      "https://cdn.dropi.co/rmp.jpg"',
    '    variations[0]:',
    '  - id: 202',
    '    sku: SAB-01',
    '    name: Sábana térmica',
    '    sale_price: 30000',
    '    suggested_price: 0',
    '    simple_price: 31000',
    '    stock: 0',
    '    supplier_id: 778',
    '    categories[1]: Hogar',
    '    gallery[1]{url}:',
    '      "https://cdn.dropi.co/sab.jpg"',
    '    variations[3]:',
    '      - id: 9001',
    '        sku: SAB-01-BS',
    '        stock: 4',
    '        sale_price: 30000',
    '        suggested_price: 52000',
    '        attributes[2]{name,value}:',
    '          COLOR,BEIGE',
    '          MEDIDA,SENCILLA',
    '      - id: 9002',
    '        sku: SAB-01-BD',
    '        stock: 2',
    '        sale_price: 34000',
    '        suggested_price: 60000',
    '        attributes[2]{name,value}:',
    '          COLOR,BEIGE',
    '          MEDIDA,DOBLE',
    '      - id: 9003',
    '        sku: SAB-01-GD',
    '        stock: 0',
    '        sale_price: 34000',
    '        suggested_price: 60000',
    '        attributes[2]{name,value}:',
    '          COLOR,GRIS',
    '          MEDIDA,DOBLE',
    '  - id: 303',
    '    sku: AGT-00',
    '    name: Producto agotado',
    '    sale_price: 1000',
    '    suggested_price: 5000',
    '    simple_price: 1100',
    '    stock: 0',
    '    supplier_id: 779',
    '    categories[0]:',
    '    gallery[0]:',
    '    variations[0]:',
    '  - id: 404',
    '    sku: SNP-00',
    '    name: Sin precio sugerido',
    '    sale_price: 1000',
    '    suggested_price: 0',
    '    simple_price: 1100',
    '    stock: 50',
    '    supplier_id: 780',
    '    categories[0]:',
    '    gallery[0]:',
    '    variations[0]:',
    'count: 4',
    `currency: ${over.currency ?? 'COP'}`
  );
}

export const LIST_PRODUCTS = listProducts();

export const LIST_PRODUCTS_EMPTY = lines('items[0]:', 'count: 0', 'currency: COP');

/** Two cities with the same name in different departments (CUNDINAMARCA = 3, RISARALDA = 21). */
export const SEARCH_CITIES_AMBIGUOUS = lines(
  'items[2]{id,department_id,name,cod_dane,zip_code}:',
  '  2001,3,GUAYABAL,"",""',
  '  2002,21,GUAYABAL,"",""',
  'count: 2'
);

export const SEARCH_CITIES_EMPTY = lines('items[0]:', 'count: 0');

/** quote_shipping in the real shape with parametrized ENVIA / DEROCHA-EXPRESS costs. */
export function quoteShipping(costs: { envia: number; derocha: number }): string {
  return lines(
    'carriers[4]{carrier,service,shipping_cost,insurance,trajectory,error}:',
    `  DEROCHA-EXPRESS,normal,${costs.derocha},null,"",null`,
    `  ENVIA,normal,${costs.envia},null,URBANO,null`,
    '  INTERRAPIDISIMO,normal,null,null,"",Esta transportadora solo acepta envíos con pago contra entrega desde $45.000 COP.',
    '  DESCONOCIDA,normal,9000,null,"",null',
    'count: 4',
    'currency: COP'
  );
}

export const QUOTE_NO_COVERAGE = lines(
  'carriers[1]{carrier,service,shipping_cost,insurance,trajectory,error}:',
  '  ENVIA,normal,null,null,"",La transportadora no está disponible para este envío.',
  'count: 1',
  'currency: COP'
);

// ── JSON path (one case per parser) ──────────────────────────────────────────

export const JSON_LIST_PRODUCTS = {
  items: [
    {
      id: 101, sku: 'RMP-500', name: 'Rompecabezas 500 piezas', sale_price: 14900, suggested_price: 29166,
      simple_price: 15500, stock: 12, supplier_id: 777, categories: ['Juguetes'],
      gallery: [{ urlS3: 'https://cdn.dropi.co/rmp.jpg' }], variations: [{}],
    },
  ],
  count: 1,
  currency: 'COP',
};

export const JSON_LIST_CATEGORIES = { items: [{ id: 5, name: 'Juguetes' }, { id: 6, name: 'Hogar' }] };

export const JSON_SEARCH_CITIES = { items: [{ id: 70, department_id: 3, name: 'CAJICA', cod_dane: '25126000', zip_code: '' }] };

export const JSON_QUOTE = {
  carriers: [
    { carrier: 'ENVIA', service: 'normal', shipping_cost: 12758, insurance: null, trajectory: 'URBANO', error: null },
    { carrier: 'VELOCES', service: 'normal', shipping_cost: null, insurance: null, trajectory: '', error: 'No disponible' },
  ],
  currency: 'COP',
};

export const JSON_CREATE_ORDER_OK = { order_id: '96972142', status: 'PENDIENTE', total: 35000, currency: 'COP', created_at: '2026-11-10 14:03:22' };

export const JSON_CREATE_ORDER_CARRIER_ERROR = {
  error: { code: 3, message: 'La ciudad no tiene habilitado el médoto de envío: CON RECAUDO - CAJICA-CUNDINAMARCA-DEROCHA-EXPRESS-[]' },
};

export const JSON_GET_ORDER = {
  order_id: '96972142',
  status: 'PENDIENTE',
  customer: { name: 'Ana Pérez', phone: '3001234567', document: '1020304050', address: 'Calle 1 # 2-3', city: 'CAJICA' },
  items: [{ product_id: 101, product_name: 'Rompecabezas 500 piezas', qty: 1, unit_price: 35000, subtotal: 35000 }],
  total: 35000,
  currency: 'COP',
  created_at: '2026-11-10 14:03:22',
};

/** Two rows: only the one with the requested order_id counts. */
export const JSON_LIST_ORDERS = {
  items: [
    { order_id: '96972140', status: 'ENTREGADO', customer_name: 'Otro Cliente', customer_phone: '3000000000', shipping_company: 'INTERRAPIDISIMO', created_at: '2026-11-09 10:00:00' },
    { order_id: '96972142', status: 'PENDIENTE', customer_name: 'Ana Pérez', customer_phone: '3001234567', shipping_company: 'ENVIA', created_at: '2026-11-10 14:03:22' },
  ],
  count: 2,
};
