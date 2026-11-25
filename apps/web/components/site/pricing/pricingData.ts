/**
 * Datos de la página de precios. Todo número sale de `@gensmart/shared`
 * (PLAN_LIMITS, PRICING, MESSAGE_ADDONS, USAGE_WARNING_PERCENT) y de SITE_TRIAL_DAYS.
 * Son funciones puras: las usan los componentes (cliente) y la página (metadatos y JSON-LD),
 * así el texto visible y el JSON-LD de las preguntas frecuentes son el mismo.
 */
import type { Crumb } from '../Breadcrumbs/crumbs';
import type { FaqItem } from '../FaqList/faq';
import {
  MESSAGE_ADDONS,
  PLAN_LIMITS,
  PRICING,
  USAGE_WARNING_PERCENT,
} from '@gensmart/shared';
import type { RegisterPlan } from '@/lib/site-links';
import type { SiteLanguage } from '@/lib/site-routes';
import type { SiteT } from '@/lib/site-t';
import { SITE_TRIAL_DAYS } from '../siteTrial';

/** Migas de Precios: las usan el hero y el JSON-LD `BreadcrumbList`. */
export const PRICING_CRUMBS: readonly Crumb[] = [
  { id: 'home', labelKey: 'site.crumbs.home' },
  { id: 'pricing', labelKey: 'site.crumbs.pricing' },
];

export type PlanId = RegisterPlan | 'enterprise';

export const PLAN_IDS: readonly PlanId[] = ['solo', 'starter', 'pro', 'enterprise'];
export const PLAN_NAMES: Record<PlanId, string> = {
  solo: 'Solo',
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
};
/** Plan destacado ("Recomendado"). */
export const FEATURED_PLAN: PlanId = 'pro';
/** Planes con prueba autoservicio. Enterprise se contrata con ventas. */
export const TRIAL_PLANS: readonly RegisterPlan[] = ['solo', 'starter', 'pro'];

export type Billing = 'monthly' | 'yearly';

const P = 'site.pricing';

/** Descuento anual en %, desde PRICING (igual en todos los planes). */
export const YEARLY_DISCOUNT_PERCENT = Math.round(PRICING.solo.yearlyDiscount * 100);

/** 1.000 en español y 1,000 en inglés; un decimal solo si hace falta (23,2 / 23.2). */
export function formatNumber(lang: SiteLanguage, value: number): string {
  return new Intl.NumberFormat(lang, { useGrouping: 'always', maximumFractionDigits: 1 }).format(value);
}

/** Precio: entero sin decimales ($16) y, si tiene centavos, siempre dos ($23,20 / $23.20). */
export function formatPrice(lang: SiteLanguage, value: number): string {
  const cents = !Number.isInteger(value);
  return new Intl.NumberFormat(lang, {
    useGrouping: 'always',
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  }).format(value);
}

/** Precio por mes según el periodo: el anual se muestra dividido entre 12. */
export function pricePerMonth(id: PlanId, billing: Billing): number {
  const price = PRICING[id];
  return billing === 'monthly' ? price.monthly : Math.round((price.yearly / 12) * 100) / 100;
}

/** "a, b y c" con la conjunción del idioma (sin coma de Oxford, como el diseño). */
export function joinList(items: readonly string[], conjunction: string): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} ${conjunction} ${items[items.length - 1]}`;
}

const ALL_CHANNELS = PLAN_LIMITS.enterprise.channels;
/** Orden en que el diseño nombra los canales. */
const CHANNEL_ORDER = ['whatsapp', 'web', 'instagram', 'facebook', 'telegram', 'email'] as const;

function hasAllChannels(id: PlanId): boolean {
  const own = PLAN_LIMITS[id].channels as readonly string[];
  return ALL_CHANNELS.every((channel) => own.includes(channel));
}

export function channelList(t: SiteT): string {
  const names = CHANNEL_ORDER.filter((c) => (ALL_CHANNELS as readonly string[]).includes(c)).map((c) =>
    t(`${P}.channels.${c}`)
  );
  return joinList(names, t(`${P}.and`));
}

export function trialPlanNames(t: SiteT): string {
  return joinList(
    TRIAL_PLANS.map((id) => PLAN_NAMES[id]),
    t(`${P}.and`)
  );
}

/** Lista de la tarjeta de cada plan, con los textos del diseño. */
export function planFeatures(id: PlanId, t: SiteT, lang: SiteLanguage): string[] {
  const l = PLAN_LIMITS[id];
  const n = (value: number) => formatNumber(lang, value);
  const f = `${P}.feat`;
  const items: string[] = [];

  items.push(
    l.agents === Infinity
      ? t(`${f}.agentsUnlimited`)
      : t(l.agents === 1 ? `${f}.agentsOne` : `${f}.agentsMany`, { n: n(l.agents) })
  );
  items.push(t(`${f}.messages`, { n: n(l.messagesPerMonth) }));
  items.push(l.contacts === Infinity ? t(`${f}.contactsUnlimited`) : t(`${f}.contacts`, { n: n(l.contacts) }));
  items.push(
    hasAllChannels(id)
      ? t(`${f}.channelsAll`, { n: ALL_CHANNELS.length })
      : t(`${f}.channelsSome`, { n: l.channels.length })
  );
  if (l.voiceMessages && l.imageVision) items.push(t(`${f}.voiceAndImages`));
  else if (l.voiceMessages) items.push(t(`${f}.voice`));
  else if (l.imageVision) items.push(t(`${f}.images`));
  items.push(
    l.knowledgeFiles === Infinity
      ? t(`${f}.filesUnlimited`)
      : t(l.knowledgeFiles === 1 ? `${f}.filesOne` : `${f}.filesMany`, { n: n(l.knowledgeFiles) })
  );
  items.push(t(`${P}.support.${id}`));
  if (l.byoApiKey) items.push(t(`${f}.byoKey`));
  return items;
}

const METER_DOTS = 10;
const MAX_MESSAGES = Math.max(...PLAN_IDS.map((id) => PLAN_LIMITS[id].messagesPerMonth));

/** Medidor de la tarjeta: puntos de agentes (tope 10) y barra de mensajes (raíz, como el diseño: 9/20/45/100 %). */
export function planMeter(id: PlanId): { agentDots: number; messagesPercent: number } {
  const l = PLAN_LIMITS[id];
  return {
    agentDots: Math.min(l.agents, METER_DOTS),
    messagesPercent: Math.round(Math.sqrt(l.messagesPerMonth / MAX_MESSAGES) * 100),
  };
}
export const METER_TOTAL_DOTS = METER_DOTS;

// ── Comparativa ────────────────────────────────────────────────────────────

export type CompareCell = { kind: 'text'; text: string } | { kind: 'yes' } | { kind: 'no' };
export interface CompareRow {
  id: string;
  label: string;
  cells: CompareCell[];
}
export interface CompareGroup {
  id: 'core' | 'channels' | 'ai' | 'crm';
  label: string;
  rows: CompareRow[];
}

/** Largo de respuesta según maxTokensPerResponse (512 / 1024 / 2048 / 4096). */
function replyLength(tokens: number): 'short' | 'medium' | 'long' | 'veryLong' {
  if (tokens <= 512) return 'short';
  if (tokens <= 1024) return 'medium';
  if (tokens <= 2048) return 'long';
  return 'veryLong';
}

export function compareGroups(t: SiteT, lang: SiteLanguage): CompareGroup[] {
  const c = `${P}.compare`;
  const n = (value: number) => formatNumber(lang, value);
  const text = (value: string): CompareCell => ({ kind: 'text', text: value });
  const bool = (value: boolean): CompareCell => ({ kind: value ? 'yes' : 'no' });
  /** Cantidad: 0 = no incluido, Infinity = ilimitado (con el género del sustantivo). */
  const count = (value: number, gender: 'M' | 'F'): CompareCell =>
    value === 0 ? { kind: 'no' } : text(value === Infinity ? t(`${c}.unlimited${gender}`) : n(value));
  const row = (id: string, cell: (plan: PlanId) => CompareCell): CompareRow => ({
    id,
    label: t(`${c}.rows.${id}`),
    cells: PLAN_IDS.map(cell),
  });
  const L = (plan: PlanId) => PLAN_LIMITS[plan];
  const channelRow = (channel: (typeof CHANNEL_ORDER)[number]) =>
    row(channel, (p) => bool((L(p).channels as readonly string[]).includes(channel)));

  return [
    {
      id: 'core',
      label: t(`${c}.groups.core`),
      rows: [
        row('agents', (p) => count(L(p).agents, 'M')),
        row('messages', (p) => text(n(L(p).messagesPerMonth))),
        row('contacts', (p) => count(L(p).contacts, 'M')),
        row('support', (p) => text(t(`${P}.supportShort.${p}`))),
      ],
    },
    {
      id: 'channels',
      label: t(`${c}.groups.channels`),
      rows: [
        channelRow('web'),
        channelRow('whatsapp'),
        channelRow('email'),
        channelRow('telegram'),
        channelRow('facebook'),
        channelRow('instagram'),
        row('voice', (p) => bool(L(p).voiceMessages)),
        row('images', (p) => bool(L(p).imageVision)),
      ],
    },
    {
      id: 'ai',
      label: t(`${c}.groups.ai`),
      rows: [
        row('memory', (p) => text(t(`${c}.memory`, { n: n(L(p).contextWindowMessages) }))),
        row('length', (p) => text(t(`${c}.length.${replyLength(L(p).maxTokensPerResponse)}`))),
        row('byoKey', (p) => bool(L(p).byoApiKey)),
      ],
    },
    {
      id: 'crm',
      label: t(`${c}.groups.crm`),
      rows: [
        row('files', (p) => count(L(p).knowledgeFiles, 'M')),
        row('functions', (p) => count(L(p).customFunctions, 'F')),
        row('mcp', (p) => count(L(p).mcpServers, 'F')),
        row('emailAlerts', (p) => count(L(p).emailNotificationTools, 'M')),
        row('subAccounts', (p) => count(L(p).subAccounts, 'F')),
        row('takeover', (p) => bool(L(p).humanTakeover)),
      ],
    },
  ];
}

// ── Paquetes y preguntas frecuentes ─────────────────────────────────────────

export interface Pack {
  messages: string;
  price: number;
}

export function packs(t: SiteT, lang: SiteLanguage): Pack[] {
  return MESSAGE_ADDONS.map((addon) => ({
    messages: t(`${P}.packs.messages`, { n: formatNumber(lang, addon.messages) }),
    price: addon.price,
  }));
}

export function packsNote(t: SiteT): string {
  return t(`${P}.packs.note`, { warn: USAGE_WARNING_PERCENT });
}

function firstPlanWith(predicate: (id: PlanId) => boolean): string {
  const ids = PLAN_IDS.filter(predicate);
  return ids.map((id) => PLAN_NAMES[id]).join(', ');
}

/** Las 8 preguntas: el mismo texto se muestra en la página y va al JSON-LD (FAQPage). */
export function faqItems(t: SiteT, lang: SiteLanguage): FaqItem[] {
  const f = `${P}.faq`;
  const packList = joinList(
    MESSAGE_ADDONS.map((addon, i) =>
      t(i === 0 ? `${f}.packItemFirst` : `${f}.packItem`, {
        n: formatNumber(lang, addon.messages),
        price: addon.price,
      })
    ),
    t(`${P}.or`)
  );
  const takeoverPlan = PLAN_IDS.find((id) => PLAN_LIMITS[id].humanTakeover);
  const values: Record<number, Record<string, string | number>> = {
    1: { takeoverPlan: takeoverPlan ? PLAN_NAMES[takeoverPlan] : '' },
    2: { plans: trialPlanNames(t), days: SITE_TRIAL_DAYS },
    4: { warn: USAGE_WARNING_PERCENT, packs: packList },
    8: { byoPlan: firstPlanWith((id) => PLAN_LIMITS[id].byoApiKey) },
  };
  return [1, 2, 3, 4, 5, 6, 7, 8].map((i) => ({
    question: t(`${f}.items.q${i}`),
    answer: t(`${f}.items.a${i}`, values[i]),
  }));
}
