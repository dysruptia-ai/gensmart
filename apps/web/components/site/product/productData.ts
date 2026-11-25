/**
 * Datos de Producto e Integraciones. Funciones puras: las usan los componentes (cliente)
 * y las páginas (metadatos y JSON-LD), así el texto visible y el JSON-LD son el mismo.
 * Los números salen de `@gensmart/shared` y de `SITE_TRIAL_DAYS`.
 */
import { PLAN_LIMITS, PRICING } from '@gensmart/shared';
import type { SiteT } from '@/lib/site-t';
import type { SiteLanguage } from '@/lib/site-routes';
import type { Crumb } from '../Breadcrumbs/crumbs';
import type { FaqItem } from '../FaqList/faq';
import { formatNumber, trialPlanNames } from '../pricing/pricingData';
import { SITE_TRIAL_DAYS } from '../siteTrial';

export const PRODUCT_CRUMBS: readonly Crumb[] = [
  { id: 'home', labelKey: 'site.crumbs.home' },
  { id: 'product', labelKey: 'site.crumbs.product' },
];

export const INTEGRATIONS_CRUMBS: readonly Crumb[] = [
  ...PRODUCT_CRUMBS,
  { id: 'integrations', labelKey: 'site.crumbs.integrations' },
];

/** Herramientas conectables por API, MCP o webhook (cifra aprobada por el cliente). */
export const TOOLS_COUNT = 10_000;

/** Canales que atiende un mismo agente: todos los planes incluyen los mismos. */
export const CHANNEL_COUNT = PLAN_LIMITS.starter.channels.length;

/** Pasos para activar un agente (sección "Tu agente, en tres pasos"). */
export const SETUP_STEPS = 3;

/** Precio de entrada (plan Solo, mensual, USD). */
export const ENTRY_PRICE = PRICING.solo.monthly;

/** `10.000` / `10,000` según el idioma. */
export function toolsCount(lang: SiteLanguage): string {
  return formatNumber(lang, TOOLS_COUNT);
}

/** Valores que interpolan los textos de estas páginas. */
export function productValues(t: SiteT, lang: SiteLanguage) {
  return {
    days: SITE_TRIAL_DAYS,
    plans: trialPlanNames(t),
    tools: toolsCount(lang),
    count: CHANNEL_COUNT,
    price: ENTRY_PRICE,
  };
}

const B = 'site.product.bento';

/** Las cinco piezas (bento): títulos para `featureList` del JSON-LD. */
export function productFeatures(t: SiteT): string[] {
  return ['agents', 'inbox', 'crm', 'booking', 'integrations'].map((k) => t(`${B}.${k}Title`));
}

/** Las 6 preguntas: el mismo texto se muestra en la página y va al JSON-LD (FAQPage). */
export function productFaqItems(t: SiteT, lang: SiteLanguage): FaqItem[] {
  const f = 'site.product.faq.items';
  const values = productValues(t, lang);
  return [1, 2, 3, 4, 5, 6].map((i) => ({
    question: t(`${f}.q${i}`),
    answer: t(`${f}.a${i}`, values),
  }));
}
