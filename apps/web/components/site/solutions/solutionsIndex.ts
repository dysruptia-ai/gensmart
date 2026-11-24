/**
 * Índice de Soluciones (`/soluciones` ↔ `/en/solutions`): migas, anclas y JSON-LD.
 * Sin `'use client'`: la página arma el JSON-LD en el servidor.
 */
import type { SiteT } from '@/lib/site-i18n';
import { absoluteUrl, publicPath, type SiteLanguage } from '@/lib/site-routes';
import { breadcrumbJsonLd, type Crumb } from '../Breadcrumbs/crumbs';
import { INDUSTRIES } from '../industries/industriesData';
import { TEAMS } from '../teams/teamsData';

export const SOLUTIONS_CRUMBS: readonly Crumb[] = [
  { id: 'home', labelKey: 'site.crumbs.home' },
  { id: 'solutions', labelKey: 'site.crumbs.solutions' },
];

/** Anclas de las secciones (`teams` en lib/site-links apunta a `#equipos` / `#teams`). */
export const SOLUTIONS_SECTION_IDS: Record<SiteLanguage, { industries: string; teams: string }> = {
  es: { industries: 'industrias', teams: 'equipos' },
  en: { industries: 'industries', teams: 'teams' },
};

/** `BreadcrumbList` y `CollectionPage` con las 18 páginas (12 industrias y 6 equipos). */
export function solutionsIndexJsonLd(t: SiteT, lang: SiteLanguage) {
  const url = absoluteUrl(publicPath('solutions', lang));
  const pages = [...INDUSTRIES, ...TEAMS];
  return {
    '@context': 'https://schema.org',
    '@graph': [
      breadcrumbJsonLd(SOLUTIONS_CRUMBS, t, lang),
      {
        '@type': 'CollectionPage',
        '@id': `${url}#page`,
        url,
        name: t('site.meta.solutions.title'),
        description: t('site.meta.solutions.description'),
        inLanguage: lang,
        breadcrumb: { '@id': `${url}#breadcrumb` },
        mainEntity: {
          '@type': 'ItemList',
          '@id': `${url}#list`,
          name: t('site.solutions.listName'),
          numberOfItems: pages.length,
          itemListElement: pages.map((page, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: t(`${page.base}.name`),
            url: absoluteUrl(publicPath(page.id, lang)),
          })),
        },
      },
    ],
  };
}
