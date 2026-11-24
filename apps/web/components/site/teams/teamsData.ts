/**
 * Soluciones por equipo: estructura de cada página. Los textos van por clave en
 * `site.teams.<id>.*` (i18n). Las secciones son las de `../solutions`, más el
 * bloque de control (`TeamControl`).
 */
import type { SiteRouteId } from '@/lib/site-routes';
import type { SolutionData } from '../solutions/solutionsData';

export type TeamId = Extract<
  SiteRouteId,
  | 'teamSales'
  | 'teamCustomerSupport'
  | 'teamMarketing'
  | 'teamOperationsBooking'
  | 'teamHumanResources'
  | 'teamCollections'
>;

export interface TeamData extends SolutionData {
  id: TeamId;
  /** Reglas del bloque "Tú defines hasta dónde llega el agente". */
  controls: number;
}

export const TEAM_COMMON = 'site.teams.common';

const IMG = '/site/img/teams/';

/** En el orden del menú "Por equipo". */
export const TEAMS: readonly TeamData[] = [
  {
    id: 'teamSales',
    base: 'site.teams.teamSales',
    common: TEAM_COMMON,
    slug: 'sales',
    photo: { src: `${IMG}sales.webp`, position: '50% 50%' },
    integrations: ['HubSpot', 'Zoho', 'Odoo', 'Google Calendar', 'Stripe'],
    heroChat: ['in', 'out'],
    chips: 2,
    steps: 5,
    controls: 4,
    faqs: 5,
    consoleChat: ['in', 'out', 'in', 'out', 'in'],
    did: 4,
    vars: 6,
    score: 5,
    initials: 'MA',
  },
  {
    id: 'teamCustomerSupport',
    base: 'site.teams.teamCustomerSupport',
    common: TEAM_COMMON,
    slug: 'customer-support',
    photo: { src: `${IMG}customer-support.webp`, position: '72% 40%' },
    integrations: ['Zendesk', 'Shopify', 'Tiendanube', 'Gmail', 'Slack', 'Notion'],
    heroChat: ['in', 'out'],
    chips: 2,
    steps: 5,
    controls: 4,
    faqs: 5,
    consoleChat: ['in', 'out', 'in', 'out'],
    did: 4,
    vars: 4,
    initials: 'AN',
  },
  {
    id: 'teamMarketing',
    base: 'site.teams.teamMarketing',
    common: TEAM_COMMON,
    slug: 'marketing',
    photo: { src: `${IMG}marketing.webp`, position: '50% 40%' },
    integrations: ['HubSpot', 'Salesforce', 'Zoho', 'Mailchimp', 'Brevo', 'Google Sheets'],
    heroChat: ['in', 'out'],
    chips: 1,
    steps: 5,
    controls: 4,
    faqs: 5,
    consoleChat: ['in', 'out', 'in', 'out'],
    did: 3,
    vars: 3,
    score: 6,
    initials: 'JU',
  },
  {
    id: 'teamOperationsBooking',
    base: 'site.teams.teamOperationsBooking',
    common: TEAM_COMMON,
    slug: 'operations-and-bookings',
    photo: { src: `${IMG}operations-and-bookings.webp`, position: '60% 30%' },
    integrations: ['Pipedrive', 'Google Calendar', 'Gmail', 'Slack'],
    heroChat: ['in', 'out'],
    chips: 1,
    steps: 5,
    controls: 4,
    faqs: 5,
    consoleChat: ['in', 'out', 'in', 'out', 'in', 'out'],
    did: 3,
    vars: 4,
    initials: 'LA',
  },
  {
    id: 'teamHumanResources',
    base: 'site.teams.teamHumanResources',
    common: TEAM_COMMON,
    slug: 'human-resources',
    photo: { src: `${IMG}human-resources.webp`, position: '85% 35%' },
    integrations: ['Google Calendar', 'Gmail', 'Zoom', 'Microsoft Teams', 'Slack', 'Google Sheets'],
    heroChat: ['in', 'out'],
    chips: 2,
    steps: 5,
    controls: 4,
    faqs: 5,
    consoleChat: ['in', 'out', 'in', 'out'],
    did: 3,
    vars: 3,
    initials: 'SE',
  },
  {
    id: 'teamCollections',
    base: 'site.teams.teamCollections',
    common: TEAM_COMMON,
    slug: 'collections',
    photo: { src: `${IMG}collections.webp`, position: '50% 40%' },
    integrations: ['Wompi', 'ePayco', 'Mercado Pago', 'Stripe', 'PayPal', 'Siigo'],
    heroChat: ['in', 'out'],
    chips: 2,
    steps: 5,
    controls: 4,
    faqs: 5,
    consoleChat: ['in', 'out', 'in', 'out'],
    did: 3,
    vars: 4,
    initials: 'AN',
  },
];

export const TEAM_SLUGS: readonly string[] = TEAMS.map((team) => team.slug);

export function teamBySlug(slug: string): TeamData | undefined {
  return TEAMS.find((team) => team.slug === slug);
}
