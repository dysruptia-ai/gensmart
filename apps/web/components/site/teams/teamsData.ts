/**
 * Soluciones por equipo: estructura de cada página. Los textos van por clave en
 * `site.teams.<id>.*` (i18n). Funciones puras: las usan los componentes (cliente)
 * y la página (metadatos y JSON-LD).
 */
import type { SiteT } from '@/lib/site-i18n';
import type { SiteRouteId } from '@/lib/site-routes';
import type { Crumb } from '../Breadcrumbs/crumbs';
import type { ConsoleExample } from '../AgentConsole';
import type { FaqItem } from '../FaqList/faq';

export type TeamId = Extract<
  SiteRouteId,
  | 'teamSales'
  | 'teamCustomerSupport'
  | 'teamMarketing'
  | 'teamOperationsBooking'
  | 'teamHumanResources'
  | 'teamCollections'
>;

export interface TeamData {
  id: TeamId;
  /** Último segmento de la ruta interna (`/solutions/teams/{slug}`). */
  slug: string;
  photo: { src: string; position: string };
  /** Nombres de `BRAND_LOGOS` (LogoTile). */
  integrations: readonly string[];
  /** Mensajes del chat del hero (`in` cliente, `out` agente) y número de chips. */
  heroChat: readonly ('in' | 'out')[];
  chips: number;
  steps: number;
  controls: number;
  faqs: number;
  /** Mensajes de la conversación de la consola. */
  consoleChat: readonly ('in' | 'out')[];
  did: number;
  vars: number;
  /** Puntaje del lead (0 a 10). Sin él, la consola muestra el estado de la conversación. */
  score?: number;
  initials: string;
}

const IMG = '/site/img/teams/';

/** En el orden del menú "Por equipo". */
export const TEAMS: readonly TeamData[] = [
  {
    id: 'teamSales',
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

export const teamKey = (id: TeamId) => `site.teams.${id}`;
export const COMMON = 'site.teams.common';

export const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i + 1);

/** Inicio / Soluciones (texto, sin página todavía) / Equipo. */
export function teamCrumbs(id: TeamId): readonly Crumb[] {
  return [
    { id: 'home', labelKey: 'site.crumbs.home' },
    { id: null, labelKey: 'site.crumbs.solutions' },
    { id, labelKey: `site.crumbs.${id}` },
  ];
}

/** Las 3 siguientes en orden circular: cada página recibe 3 enlaces internos. */
export function otherTeams(id: TeamId): readonly TeamData[] {
  const i = TEAMS.findIndex((team) => team.id === id);
  return [1, 2, 3].map((n) => TEAMS[(i + n) % TEAMS.length]);
}

/** Mismo texto que el JSON-LD `FAQPage`. */
export function teamFaqItems(team: TeamData, t: SiteT): FaqItem[] {
  const k = teamKey(team.id);
  return range(team.faqs).map((i) => ({
    question: t(`${k}.faq.q${i}.question`),
    answer: t(`${k}.faq.q${i}.answer`),
  }));
}

/** Conversación de la consola de la bandeja. */
export function teamConsole(team: TeamData): ConsoleExample {
  const c = `${teamKey(team.id)}.console`;
  return {
    initials: team.initials,
    nameKey: `${c}.name`,
    metaKey: [`${c}.channel`, `${teamKey(team.id)}.label`, `${c}.stage`],
    summaryKey: `${c}.summary`,
    bubbles: team.consoleChat.map((dir, i) => ({ key: `${c}.m${i + 1}`, out: dir === 'out' })),
    score: team.score,
    data: [
      { labelKey: 'site.home.how.leadChannel', valueKey: `${c}.channel` },
      { labelKey: 'site.home.how.leadStage', valueKey: `${c}.stage` },
    ],
    vars: range(team.vars).map((i) => ({ nameKey: `${c}.vars.v${i}.name`, valueKey: `${c}.vars.v${i}.value` })),
    didKeys: range(team.did).map((i) => `${c}.did${i}`),
  };
}
