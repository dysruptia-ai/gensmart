/**
 * Datos de la landing E-commerce (`/soluciones/ecommerce`). Sin `'use client'`:
 * la página arma con esto el JSON-LD en el servidor y los componentes pintan lo mismo.
 * Los textos viven en `site.ecommerce.*`; aquí solo la estructura y las cifras.
 */
import { PRICING } from '@gensmart/shared';
import type { SiteT } from '@/lib/site-i18n';
import { absoluteUrl, publicPath, type SiteLanguage } from '@/lib/site-routes';
import { breadcrumbJsonLd } from '../Breadcrumbs/crumbs';
import { faqPageJsonLd, type FaqItem } from '../FaqList/faq';
import { solutionCrumbs } from '../solutions/solutionsData';
import { PLAN_IDS, PLAN_NAMES, TRIAL_PLANS, type PlanId } from '../pricing/pricingData';

export const E = 'site.ecommerce';
export const ECOMMERCE_CRUMBS = solutionCrumbs('ecommerce');

/** Promedio de abandono (Baymard, 50 estudios 2006–2025; actualizado el 22-09-2025). */
export const ABANDON_RATE = 0.7022;
export const BAYMARD_URL = 'https://baymard.com/lists/cart-abandonment-rate';
/** Motivos de abandono en % (Baymard, compradores de EE. UU. sin los que solo miraban). */
export const ABANDON_REASONS: readonly number[] = [40, 20, 19, 17, 13, 9];

export type PlatformKind = 'store' | 'cod';
export interface Platform {
  /** Clave en `site.ecommerce.platforms.items` y nombre en `BRAND_LOGOS`. */
  id: string;
  name: string;
  kind: PlatformKind;
  /** Quién escribe cada uno de los 4 momentos: `c` cliente, `a` agente (lo inicia el agente). */
  who: readonly ('c' | 'a')[];
  /** Cuántas funciones toca en la plataforma (`touch.c1…cN`). */
  touches: number;
}

export const PLATFORMS: readonly Platform[] = [
  { id: 'tiendanube', name: 'Tiendanube', kind: 'store', who: ['c', 'c', 'c', 'c'], touches: 9 },
  { id: 'shopify', name: 'Shopify', kind: 'store', who: ['c', 'c', 'c', 'c'], touches: 10 },
  { id: 'woocommerce', name: 'WooCommerce', kind: 'store', who: ['c', 'c', 'c', 'c'], touches: 9 },
  { id: 'venndelo', name: 'Venndelo', kind: 'cod', who: ['a', 'c', 'c', 'c'], touches: 8 },
  { id: 'dropi', name: 'Dropi', kind: 'cod', who: ['c', 'a', 'c', 'c'], touches: 9 },
  { id: 'dropea', name: 'Dropea', kind: 'cod', who: ['c', 'a', 'c', 'c'], touches: 6 },
  { id: 'mastershop', name: 'Mastershop', kind: 'cod', who: ['c', 'c', 'c', 'c'], touches: 6 },
];

/** Tarjetas de "Ubica tu tienda": logos y a qué plataforma lleva (`null` = al registro). */
export const STORE_CASES: readonly { logos: readonly string[]; platform: number | null }[] = [
  { logos: ['Tiendanube', 'Shopify', 'WooCommerce'], platform: 0 },
  { logos: ['Venndelo', 'Dropi', 'Dropea', 'Mastershop'], platform: 3 },
  { logos: ['WhatsApp', 'Instagram'], platform: null },
];

/** Anclas del diseño (las mismas en los dos idiomas). */
export const PLATFORMS_ID = 'plataformas';
export const CALC_ID = 'calc';

/** Precio mensual de cada plan, de `PRICING` (calculadora y escalera). */
export const PLAN_PRICES: readonly { id: PlanId; name: string; price: number }[] = PLAN_IDS.map((id) => ({
  id,
  name: PLAN_NAMES[id],
  price: PRICING[id].monthly,
}));

export interface CalcInput {
  conversations: number | null;
  buyPer100: number | null;
  ticket: number | null;
  latePercent: number | null;
  minutes: number | null;
}

export interface CalcResult {
  /** Ventas que se escapan al mes (USD), o `null` si faltan datos. */
  lost: number | null;
  /** Horas de conversación al mes, o `null`. */
  hours: number | null;
  /** Pedidos que pagan cada plan (`ceil(precio / ticket)`), o `null` sin ticket. */
  orders: Record<PlanId, number> | null;
  /** Plan de prueba más alto que cuesta ≤ 25 % de lo que se escapa (Solo si ninguno). */
  payoffPlan: PlanId | null;
}

const ok = (n: number | null): n is number => n !== null && Number.isFinite(n) && n > 0;

/**
 * Fórmulas del diseño. Un campo vacío o en 0 cuenta como "falta el dato" (el resultado
 * es "–"): así nunca hay división por cero, `NaN` ni `Infinity`.
 */
export function calculate(input: CalcInput): CalcResult {
  const { conversations: c, buyPer100: b, ticket: t, latePercent: l, minutes: m } = input;
  const lost = ok(c) && ok(b) && ok(t) && ok(l) ? c * (l / 100) * (b / 100) * t : null;
  const hours = ok(c) && ok(m) ? (c * m) / 60 : null;
  const orders = ok(t)
    ? (Object.fromEntries(PLAN_PRICES.map((p) => [p.id, Math.ceil(p.price / t)])) as Record<PlanId, number>)
    : null;
  let payoffPlan: PlanId | null = null;
  if (lost !== null) {
    payoffPlan = TRIAL_PLANS[0];
    for (const id of [...TRIAL_PLANS].reverse()) {
      if (PRICING[id].monthly / lost <= 0.25) {
        payoffPlan = id;
        break;
      }
    }
  }
  return { lost, hours, orders, payoffPlan };
}

/** 70,22 % / 70.22%: `Intl` con el espacio y el separador de cada idioma. */
export function formatPercent(lang: SiteLanguage, percent: number, digits = 0): string {
  return new Intl.NumberFormat(lang, {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(percent / 100);
}

/** Las 5 preguntas: el mismo texto va a la página y al JSON-LD `FAQPage`. */
export function ecommerceFaqItems(t: SiteT): FaqItem[] {
  return [1, 2, 3, 4, 5].map((i) => ({
    question: t(`${E}.faq.items.q${i}.question`),
    answer: t(`${E}.faq.items.q${i}.answer`),
  }));
}

export function ecommerceJsonLd(t: SiteT, lang: SiteLanguage) {
  const url = absoluteUrl(publicPath('ecommerce', lang));
  return {
    '@context': 'https://schema.org',
    '@graph': [breadcrumbJsonLd(ECOMMERCE_CRUMBS, t, lang), faqPageJsonLd(ecommerceFaqItems(t), url, lang)],
  };
}
