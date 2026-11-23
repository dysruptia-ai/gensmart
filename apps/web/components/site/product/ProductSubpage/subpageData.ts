/**
 * Datos comunes de las subpáginas de Producto. Funciones puras: las usan los componentes
 * (cliente) y las páginas (metadatos y JSON-LD).
 */
import { PLAN_LIMITS } from '@gensmart/shared';
import type { SiteLanguage, SiteRouteId } from '@/lib/site-routes';
import type { Crumb } from '../../Breadcrumbs/crumbs';
import { PLAN_NAMES } from '../../pricing/pricingData';
import { CHANNEL_COUNT, PRODUCT_CRUMBS } from '../productData';

export type ProductSubpageId = Extract<
  SiteRouteId,
  'productAgents' | 'productInbox' | 'productCrm' | 'productBooking'
>;

/** Inicio / Producto / Página. */
export function subpageCrumbs(id: ProductSubpageId): readonly Crumb[] {
  return [...PRODUCT_CRUMBS, { id, labelKey: `site.crumbs.${id}` }];
}

const NUMBER_WORDS: Record<SiteLanguage, readonly string[]> = {
  es: ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez'],
  en: ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'],
};

/** Número en palabras ("seis"), o en cifras si pasa de diez. */
export function numberWord(lang: SiteLanguage, n: number, capitalize = false): string {
  const word = NUMBER_WORDS[lang][n] ?? String(n);
  return capitalize ? word.charAt(0).toUpperCase() + word.slice(1) : word;
}

/** Valores de los textos de las subpáginas: el número de canales sale de `PLAN_LIMITS`. */
export function subpageValues(lang: SiteLanguage) {
  return {
    count: CHANNEL_COUNT,
    countWord: numberWord(lang, CHANNEL_COUNT),
    CountWord: numberWord(lang, CHANNEL_COUNT, true),
  };
}

/** Nombre del plan que permite usar la llave de API propia (`byoApiKey`). */
export function byoKeyPlanName(): string | null {
  const id = (Object.keys(PLAN_LIMITS) as Array<keyof typeof PLAN_LIMITS>).find(
    (plan) => PLAN_LIMITS[plan].byoApiKey
  );
  return id ? PLAN_NAMES[id] : null;
}
