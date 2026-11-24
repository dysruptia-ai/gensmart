/**
 * Casos de uso (`/soluciones/casos-de-uso` ↔ `/en/solutions/use-cases`): los 6 trabajos
 * del agente (design/web: `casos`). Los textos van en `site.useCases.*`.
 * Sin `'use client'`: la página arma el JSON-LD en el servidor.
 */
import type { SiteT } from '@/lib/site-i18n';
import type { SiteLanguage } from '@/lib/site-routes';
import type { SiteLinkKey } from '@/lib/site-links';
import { breadcrumbJsonLd } from '../Breadcrumbs/crumbs';
import { solutionCrumbs } from '../solutions/solutionsData';

export const U = 'site.useCases';

export const USE_CASES_CRUMBS = solutionCrumbs('cases');

/** Paso de la línea de tiempo: mensaje del cliente, del agente o acción en tus sistemas. */
export type JobStep = 'in' | 'out' | 'act';

export interface UseCaseJob {
  /** Clave en `site.useCases.jobs` y base de los `id` de pestaña y vista. */
  id: 'sell' | 'qualify' | 'book' | 'systems' | 'collect' | 'always';
  /** Tipo de cada paso, en orden (`steps.s1`, `steps.s2`…). */
  steps: readonly JobStep[];
  /** Página de "Lo que recibe tu equipo". */
  link: SiteLinkKey;
}

export const JOBS: readonly UseCaseJob[] = [
  { id: 'sell', steps: ['in', 'act', 'out', 'act', 'in', 'act', 'out', 'act', 'act'], link: 'ecommerce' },
  { id: 'qualify', steps: ['in', 'out', 'in', 'act', 'act', 'act', 'out', 'act'], link: 'productCrm' },
  { id: 'book', steps: ['in', 'act', 'out', 'in', 'act', 'act', 'act', 'out'], link: 'productBooking' },
  { id: 'systems', steps: ['in', 'act', 'out', 'in', 'out', 'act'], link: 'integrations' },
  { id: 'collect', steps: ['in', 'act', 'out', 'act', 'in', 'act'], link: 'teamCollections' },
  { id: 'always', steps: ['in', 'act', 'out', 'in', 'act', 'act'], link: 'productInbox' },
];

/** "Tú defines hasta dónde llega el agente": `true` = lo configuras tú, `false` = límite fijo. */
export const LIMITS: readonly boolean[] = [true, true, true, true, false, false];

/** Solo `BreadcrumbList`: la página no tiene preguntas frecuentes. */
export function casesJsonLd(t: SiteT, lang: SiteLanguage) {
  return {
    '@context': 'https://schema.org',
    '@graph': [breadcrumbJsonLd(USE_CASES_CRUMBS, t, lang)],
  };
}
