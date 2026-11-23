export interface BrandLogo {
  /** `null` = no hay logo en el diseño: la ficha muestra solo el nombre. */
  src: string | null;
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
  Effi: { src: `${D}effi.png`, name: 'Effi', width: 328, height: 160, wordmark: true },
  Salesforce: { src: `${D}salesforce.png`, name: 'Salesforce', width: 418, height: 293, wordmark: true },
  SAP: { src: `${D}sap.svg`, name: 'SAP', width: 22, height: 22, wordmark: false },
  Sage: { src: `${D}sage.svg`, name: 'Sage', width: 22, height: 22, wordmark: false },
  Xero: { src: `${D}xero.svg`, name: 'Xero', width: 22, height: 22, wordmark: false },
  QuickBooks: { src: `${D}quickbooks.svg`, name: 'QuickBooks', width: 22, height: 22, wordmark: false },
  Airtable: { src: `${D}airtable.svg`, name: 'Airtable', width: 22, height: 22, wordmark: false },
  'Google Drive': { src: `${D}googledrive.svg`, name: 'Google Drive', width: 22, height: 22, wordmark: false },
  Dropbox: { src: `${D}dropbox.svg`, name: 'Dropbox', width: 22, height: 22, wordmark: false },
  DocuSign: { src: `${D}docusign.png`, name: 'DocuSign', width: 262, height: 208, wordmark: true },
  Asana: { src: `${D}asana.svg`, name: 'Asana', width: 22, height: 22, wordmark: false },
  ClickUp: { src: `${D}clickup.svg`, name: 'ClickUp', width: 22, height: 22, wordmark: false },
  Trello: { src: `${D}trello.svg`, name: 'Trello', width: 22, height: 22, wordmark: false },
  Synchroteam: { src: `${D}synchroteam.svg`, name: 'Synchroteam', width: 526, height: 129, wordmark: true },
  Square: { src: `${D}square.svg`, name: 'Square', width: 22, height: 22, wordmark: false },
  Wompi: { src: `${D}wompi.svg`, name: 'Wompi', width: 316, height: 74, wordmark: true },
  // El diseño usa davipay.png con el nombre ePayco (ePayco es de Davivienda)
  ePayco: { src: `${D}davipay.png`, name: 'ePayco', width: 600, height: 146, wordmark: true },
  // Sin logo en el diseño: solo el nombre
  Bold: { src: null, name: 'Bold', width: 0, height: 0, wordmark: false },
  Addi: { src: null, name: 'Addi', width: 0, height: 0, wordmark: false },
  Twilio: { src: `${D}twilio.png`, name: 'Twilio', width: 538, height: 163, wordmark: true },
  Slack: { src: `${D}slack.png`, name: 'Slack', width: 695, height: 174, wordmark: true },
  'Microsoft Teams': { src: `${D}teams.png`, name: 'Microsoft Teams', width: 463, height: 486, wordmark: false },
  Intercom: { src: `${D}intercom.svg`, name: 'Intercom', width: 22, height: 22, wordmark: false },
  Gmail: { src: `${D}gmail.svg`, name: 'Gmail', width: 22, height: 22, wordmark: false },
  Outlook: { src: `${D}outlook.png`, name: 'Outlook', width: 321, height: 293, wordmark: true },
  Brevo: { src: `${D}brevo.svg`, name: 'Brevo', width: 22, height: 22, wordmark: false },
  Zoom: { src: `${D}zoom.svg`, name: 'Zoom', width: 22, height: 22, wordmark: false },
};
