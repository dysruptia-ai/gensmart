/**
 * Migas de pan del sitio público. Sin `'use client'`: la página arma con esto
 * el JSON-LD `BreadcrumbList` en el servidor y `Breadcrumbs` pinta lo mismo.
 */
import type { SiteT } from '@/lib/site-i18n';
import { absoluteUrl, publicPath, type SiteLanguage, type SiteRouteId } from '@/lib/site-routes';

export interface Crumb {
  /** Página del registro (`lib/site-routes`): el enlace sale en el idioma correcto. */
  id: SiteRouteId;
  /** Clave de i18n del texto de la miga. */
  labelKey: string;
}

/** JSON-LD `BreadcrumbList` con el mismo texto visible. La última miga es la página actual. */
export function breadcrumbJsonLd(crumbs: readonly Crumb[], t: SiteT, lang: SiteLanguage) {
  const current = crumbs[crumbs.length - 1];
  const url = current ? absoluteUrl(publicPath(current.id, lang)) : undefined;
  return {
    '@type': 'BreadcrumbList',
    '@id': url ? `${url}#breadcrumb` : undefined,
    inLanguage: lang,
    itemListElement: crumbs.map((crumb, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t(crumb.labelKey),
      item: absoluteUrl(publicPath(crumb.id, lang)),
    })),
  };
}
