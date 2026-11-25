/**
 * Datos de Integraciones. Funciones puras: las usan los componentes y la página (JSON-LD).
 * El directorio se publica completo (decisión del cliente): GenSmart conecta estas
 * herramientas con funciones personalizadas, el cliente MCP y webhooks.
 */
import { PLAN_LIMITS } from '@gensmart/shared';
import type { SiteT } from '@/lib/site-t';
import { PLAN_IDS, PLAN_NAMES, type PlanId } from '../pricing/pricingData';

const D = 'site.integrations.dir';

export interface ToolCategory {
  key: 'stores' | 'crm' | 'productivity' | 'payments' | 'comms';
  /** Nombres de `BRAND_LOGOS`. */
  tools: readonly string[];
}

export const TOOL_CATEGORIES: readonly ToolCategory[] = [
  {
    key: 'stores',
    tools: ['Tiendanube', 'Shopify', 'WooCommerce', 'Venndelo', 'Dropi', 'Dropea', 'Mastershop'],
  },
  {
    key: 'crm',
    tools: ['HubSpot', 'Effi', 'Salesforce', 'Zoho', 'Odoo', 'SAP', 'Sage', 'Xero', 'QuickBooks'],
  },
  {
    key: 'productivity',
    tools: [
      'Google Calendar',
      'Calendly',
      'Google Sheets',
      'Notion',
      'Airtable',
      'Google Drive',
      'Dropbox',
      'DocuSign',
      'Asana',
      'ClickUp',
      'Trello',
      'Synchroteam',
    ],
  },
  {
    key: 'payments',
    tools: ['Stripe', 'PayPal', 'Square', 'Mercado Pago', 'Wompi', 'ePayco', 'Bold', 'Addi'],
  },
  {
    key: 'comms',
    tools: [
      'Twilio',
      'Slack',
      'Microsoft Teams',
      'Zendesk',
      'Intercom',
      'Gmail',
      'Outlook',
      'Mailchimp',
      'Brevo',
      'Zoom',
    ],
  },
];

export function categoryTitle(t: SiteT, key: ToolCategory['key']): string {
  return t(`${D}.${key}`);
}

/** Límite por plan, en texto: "No" si es 0 e "Ilimitadas/Ilimitados" si es `Infinity`. */
export interface PlanLimitCell {
  plan: string;
  value: string;
  off: boolean;
}

function limitCells(
  t: SiteT,
  read: (id: PlanId) => number,
  unlimitedKey: 'unlimitedF' | 'unlimitedM'
): PlanLimitCell[] {
  return PLAN_IDS.map((id) => {
    const n = read(id);
    const value =
      n === 0
        ? t('site.integrations.ways.no')
        : n === Infinity
          ? t(`site.integrations.ways.${unlimitedKey}`)
          : String(n);
    return { plan: PLAN_NAMES[id], value, off: n === 0 };
  });
}

/** Funciones personalizadas por plan (`PLAN_LIMITS.*.customFunctions`). */
export function customFunctionCells(t: SiteT): PlanLimitCell[] {
  return limitCells(t, (id) => PLAN_LIMITS[id].customFunctions, 'unlimitedF');
}

/** Servidores MCP por plan (`PLAN_LIMITS.*.mcpServers`). */
export function mcpServerCells(t: SiteT): PlanLimitCell[] {
  return limitCells(t, (id) => PLAN_LIMITS[id].mcpServers, 'unlimitedM');
}
