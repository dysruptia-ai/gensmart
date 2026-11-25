/**
 * Piezas comunes de las páginas de Soluciones (equipos e industrias). Cada página
 * guarda sus textos en `{base}.*` y los compartidos en `{common}.*` (i18n), con la
 * misma forma en los dos grupos. Funciones puras: las usan los componentes (cliente)
 * y las páginas (metadatos y JSON-LD).
 */
import type { SiteT } from '@/lib/site-t';
import type { SiteRouteId } from '@/lib/site-routes';
import type { Crumb } from '../Breadcrumbs/crumbs';
import type { ConsoleBubble, ConsoleExample } from '../AgentConsole';
import type { FaqItem } from '../FaqList/faq';

/** Mensaje de la consola: del cliente, del agente o la tarjeta de producto (sale del agente). */
export type ConsoleRow = 'in' | 'out' | 'card';

export interface SolutionData {
  id: SiteRouteId;
  /** Último segmento de la ruta interna. */
  slug: string;
  /** Prefijo de los textos propios (`site.teams.teamSales`). */
  base: string;
  /** Prefijo de los textos compartidos del grupo (`site.teams.common`). */
  common: string;
  /**
   * Foto del hero. `light`: foto clara, que se aclara menos al pasarla a duotono
   * (design/web: `HERO_LIGHT`). Por defecto, `true`.
   */
  photo: { src: string; position: string; light?: boolean };
  /** Nombres de `BRAND_LOGOS` (LogoTile). */
  integrations: readonly string[];
  /** Mensajes del chat del hero (`in` cliente, `out` agente) y número de chips. */
  heroChat: readonly ('in' | 'out')[];
  chips: number;
  /** Subsectores bajo el lead (`{base}.subs.s1…`), hasta 6. Solo industrias. */
  subs?: number;
  steps: number;
  faqs: number;
  consoleChat: readonly ConsoleRow[];
  did: number;
  vars: number;
  /** Puntaje del lead (0 a 10). Sin él, la consola muestra el estado de la conversación. */
  score?: number;
  initials: string;
}

export const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i + 1);

/** Inicio / Soluciones / Página. */
export function solutionCrumbs(id: SiteRouteId): readonly Crumb[] {
  return [
    { id: 'home', labelKey: 'site.crumbs.home' },
    { id: 'solutions', labelKey: 'site.crumbs.solutions' },
    { id, labelKey: `site.crumbs.${id}` },
  ];
}

/** Las 3 siguientes en orden circular: cada página recibe 3 enlaces de sus pares. */
export function nextThree<T extends { id: SiteRouteId }>(list: readonly T[], id: SiteRouteId): readonly T[] {
  const i = list.findIndex((item) => item.id === id);
  return [1, 2, 3].map((n) => list[(i + n) % list.length]);
}

/** Mismo texto que el JSON-LD `FAQPage`. */
export function solutionFaqItems(page: SolutionData, t: SiteT): FaqItem[] {
  return range(page.faqs).map((i) => ({
    question: t(`${page.base}.faq.q${i}.question`),
    answer: t(`${page.base}.faq.q${i}.answer`),
  }));
}

/** Conversación de la consola de la bandeja. */
export function solutionConsole(page: SolutionData): ConsoleExample {
  const c = `${page.base}.console`;
  let m = 0;
  const bubbles: ConsoleBubble[] = page.consoleChat.map((row) => {
    if (row === 'card') {
      return {
        key: `${c}.card.name`,
        out: true,
        card: {
          detailKey: `${c}.card.detail`,
          priceKey: `${c}.card.price`,
          image: '/site/img/industries/ecom-chaqueta.webp',
        },
      };
    }
    m += 1;
    return { key: `${c}.m${m}`, out: row === 'out' };
  });
  return {
    initials: page.initials,
    nameKey: `${c}.name`,
    metaKey: [`${c}.channel`, `${page.base}.label`, `${c}.stage`],
    summaryKey: `${c}.summary`,
    bubbles,
    score: page.score,
    data: [
      { labelKey: 'site.home.how.leadChannel', valueKey: `${c}.channel` },
      { labelKey: 'site.home.how.leadStage', valueKey: `${c}.stage` },
    ],
    vars: range(page.vars).map((i) => ({ nameKey: `${c}.vars.v${i}.name`, valueKey: `${c}.vars.v${i}.value` })),
    didKeys: range(page.did).map((i) => `${c}.did${i}`),
  };
}
