/**
 * Test fixtures shaped like the real Dropi MCP responses documented for the sales toolkit
 * (prompt 06 "Hechos verificados"). Values are illustrative; shapes and quirks are the real ones:
 * `variations: [{}]` on simple products, product stock 0 with stocked variations, gallery with
 * `urlS3` or `url`, accentless upper-case city names, carriers by name, `{error:{code,message}}`.
 */

export const LIST_PRODUCTS = {
  items: [
    {
      id: 101,
      sku: 'RMP-500',
      name: 'Rompecabezas 500 piezas',
      sale_price: 14900,
      suggested_price: 29166,
      simple_price: 15500,
      stock: 12,
      supplier_id: 777,
      categories: [{ id: 5, name: 'Juguetes' }],
      gallery: [{ urlS3: 'https://cdn.dropi.co/rmp.jpg' }],
      variations: [{}],
    },
    {
      id: 202,
      sku: 'SAB-01',
      name: 'Sábana térmica',
      sale_price: 30000,
      suggested_price: 52000,
      simple_price: 31000,
      stock: 0,
      supplier_id: 778,
      categories: [{ id: 6, name: 'Hogar' }],
      gallery: [{ url: 'https://cdn.dropi.co/sab.jpg' }],
      variations: [
        { id: 9001, sku: 'SAB-01-BS', stock: 4, sale_price: 30000, suggested_price: 52000, attributes: [{ name: 'COLOR', value: 'BEIGE' }, { name: 'MEDIDA', value: 'SENCILLA' }] },
        { id: 9002, sku: 'SAB-01-BD', stock: 2, sale_price: 34000, suggested_price: 60000, attributes: [{ name: 'COLOR', value: 'BEIGE' }, { name: 'MEDIDA', value: 'DOBLE' }] },
        { id: 9003, sku: 'SAB-01-GD', stock: 0, sale_price: 34000, suggested_price: 60000, attributes: [{ name: 'COLOR', value: 'GRIS' }, { name: 'MEDIDA', value: 'DOBLE' }] },
      ],
    },
    {
      id: 303,
      sku: 'AGT-00',
      name: 'Producto agotado',
      sale_price: 1000,
      suggested_price: 5000,
      simple_price: 1100,
      stock: 0,
      supplier_id: 779,
      categories: [],
      gallery: [],
      variations: [{}],
    },
    {
      id: 404,
      sku: 'SNP-00',
      name: 'Sin precio sugerido',
      sale_price: 1000,
      suggested_price: 0,
      simple_price: 1100,
      stock: 50,
      supplier_id: 780,
      categories: [],
      gallery: [],
      variations: [{}],
    },
  ],
  count: 4,
  currency: 'COP',
};

export const SEARCH_CITIES_CAJICA = {
  items: [{ id: 1234, department_id: 25, name: 'CAJICA', cod_dane: '25126', zip_code: '' }],
};

export const SEARCH_CITIES_AMBIGUOUS = {
  items: [
    { id: 2001, department_id: 25, name: 'GUAYABAL', cod_dane: '', zip_code: '' },
    { id: 2002, department_id: 66, name: 'GUAYABAL', cod_dane: '', zip_code: '' },
  ],
};

export const LIST_DEPARTMENTS = {
  items: [
    { id: 25, name: 'CUNDINAMARCA' },
    { id: 66, name: 'RISARALDA' },
  ],
};

export const LIST_CARRIERS = {
  items: [
    { id: 1, name: 'ENVIA' },
    { id: 2, name: 'DEROCHA-EXPRESS' },
    { id: 3, name: 'INTERRAPIDISIMO' },
  ],
};

export const LIST_CATEGORIES = { items: [{ id: 5, name: 'Juguetes' }, { id: 6, name: 'Hogar' }] };

export function quoteShipping(costs: { envia: number; derocha: number }): unknown {
  return {
    carriers: [
      { carrier: 'DEROCHA-EXPRESS', service: 'CON RECAUDO', shipping_cost: costs.derocha, insurance: 0, trajectory: 'NACIONAL', error: null },
      { carrier: 'ENVIA', service: 'CON RECAUDO', shipping_cost: costs.envia, insurance: 0, trajectory: 'NACIONAL', error: null },
      { carrier: 'INTERRAPIDISIMO', service: 'CON RECAUDO', shipping_cost: null, insurance: 0, trajectory: 'NACIONAL', error: 'Sin cobertura' },
      { carrier: 'DESCONOCIDA', service: 'CON RECAUDO', shipping_cost: 9000, insurance: 0, trajectory: 'NACIONAL', error: null },
    ],
    currency: 'COP',
  };
}

export const CREATE_ORDER_OK = { order_id: '96972142', status: 'PENDIENTE', total: 35000, currency: 'COP', created_at: '2026-11-10 14:03:22' };

export const CREATE_ORDER_CARRIER_ERROR = {
  error: { code: 3, message: 'La ciudad no tiene habilitado el médoto de envío: CON RECAUDO - CAJICA-CUNDINAMARCA-DEROCHA-EXPRESS-[]' },
};

export const CREATE_ORDER_NO_MARGIN_ERROR = {
  error: { code: 3, message: 'No puede continuar, ya que el monto a ganar es menor o igual a cero(0)' },
};

export const GET_ORDER = {
  order_id: '96972142',
  status: 'PENDIENTE',
  customer: { name: 'Ana Pérez', phone: '3174304027', document: '1020304050', address: 'Calle 1 # 2-3', city: 'CAJICA' },
  items: [{ product_id: 101, product_name: 'Rompecabezas 500 piezas', qty: 1, unit_price: 35000, subtotal: 35000 }],
  total: 35000,
  currency: 'COP',
  payment_method: 'CON RECAUDO',
  created_at: '2026-11-10 14:03:22',
  updated_at: '2026-11-10T19:03:22Z',
};

export const LIST_ORDERS = {
  items: [
    { order_id: '96972140', status: 'ENTREGADO', customer_name: 'Otro Cliente', customer_phone: '3000000000', city: 'BOGOTA', total: 50000, currency: 'COP', payment_method: 'CON RECAUDO', shipping_company: 'INTERRAPIDISIMO', rate_type: 'CON RECAUDO', created_at: '2026-11-09 10:00:00' },
    { order_id: '96972142', status: 'PENDIENTE', customer_name: 'Ana Pérez', customer_phone: '3174304027', city: 'CAJICA', total: 35000, currency: 'COP', payment_method: 'CON RECAUDO', shipping_company: 'ENVIA', rate_type: 'CON RECAUDO', created_at: '2026-11-10 14:03:22' },
  ],
  count: 2,
  applied_range: { from: '2026-11-10', until: '2026-11-15' },
};
