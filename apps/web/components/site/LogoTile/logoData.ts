export interface BrandLogo {
  src: string;
  name: string;
  width: number;
  height: number;
  /** true = logo de marca completo (solo imagen); false = icono + nombre en texto */
  wordmark: boolean;
}

const D = '/site/img/logos/';

export const BRAND_LOGOS: Record<string, BrandLogo> = {
  Tiendanube: { src: `${D}tiendanube.png`, name: 'Tiendanube', width: 400, height: 92, wordmark: true },
  Shopify: { src: `${D}shopify-deck.png`, name: 'Shopify', width: 313, height: 109, wordmark: true },
  WooCommerce: { src: `${D}woo-deck.png`, name: 'WooCommerce', width: 271, height: 90, wordmark: true },
  Venndelo: { src: `${D}venndelo.png`, name: 'Venndelo', width: 285, height: 96, wordmark: true },
  Dropi: { src: `${D}dropi.png`, name: 'Dropi', width: 268, height: 109, wordmark: true },
  Dropea: { src: `${D}dropea.png`, name: 'Dropea', width: 264, height: 113, wordmark: true },
  Mastershop: { src: `${D}mastershop.png`, name: 'Mastershop', width: 359, height: 79, wordmark: true },
  HubSpot: { src: `${D}hubspot.svg`, name: 'HubSpot', width: 22, height: 22, wordmark: false },
  Zoho: { src: `${D}zoho.svg`, name: 'Zoho', width: 22, height: 22, wordmark: false },
  Odoo: { src: `${D}odoo.svg`, name: 'Odoo', width: 22, height: 22, wordmark: false },
  'Google Calendar': { src: `${D}googlecalendar.svg`, name: 'Google Calendar', width: 22, height: 22, wordmark: false },
  Calendly: { src: `${D}calendly.svg`, name: 'Calendly', width: 22, height: 22, wordmark: false },
  'Google Sheets': { src: `${D}googlesheets.svg`, name: 'Google Sheets', width: 22, height: 22, wordmark: false },
  Notion: { src: `${D}notion.svg`, name: 'Notion', width: 22, height: 22, wordmark: false },
  Stripe: { src: `${D}stripe.svg`, name: 'Stripe', width: 22, height: 22, wordmark: false },
  PayPal: { src: `${D}paypal.svg`, name: 'PayPal', width: 22, height: 22, wordmark: false },
  'Mercado Pago': { src: `${D}mercadopago.svg`, name: 'Mercado Pago', width: 22, height: 22, wordmark: false },
  Zendesk: { src: `${D}zendesk.svg`, name: 'Zendesk', width: 22, height: 22, wordmark: false },
  Mailchimp: { src: `${D}mailchimp.svg`, name: 'Mailchimp', width: 22, height: 22, wordmark: false },
};
