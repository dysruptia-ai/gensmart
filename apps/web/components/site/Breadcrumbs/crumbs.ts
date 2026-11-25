/**
 * Migas de pan del sitio público. Sin `'use client'`: la página arma con esto
 * el JSON-LD `BreadcrumbList` en el servidor y `Breadcrumbs` pinta lo mismo.
 */
import type { SiteT } from '@/lib/site-t';
import { absoluteUrl, publicPath, type SiteLanguage, type SiteRouteId } from '@/lib/site-routes';

export interface Crumb {
  /**
   * Página del registro (`lib/site-routes`): el enlace sale en el idioma correcto.
   * `null` = nivel sin página propia todavía (p. ej. Soluciones): se muestra como
   * texto y no entra en el JSON-LD.
   */
  id: SiteRouteId | null;
  /** Clave de i18n del texto de la miga. */
  labelKey: string;
  /** Texto ya traducido (contenido que no vive en i18n, p. ej. el título de una guía). Gana a `labelKey`. */
  label?: string;
}

/** Texto visible de una miga. */
export function crumbLabel(crumb: Crumb, t: SiteT): string {
  return crumb.label ?? t(crumb.labelKey);
}

/**
 * JSON-LD `BreadcrumbList` con el mismo texto visible. La última miga es la página actual.
 * Los niveles sin URL no van: Google pide `item` en todos menos el último.
 */
export function breadcrumbJsonLd(crumbs: readonly Crumb[], t: SiteT, lang: SiteLanguage) {
  const linked = crumbs.filter(
    (crumb): crumb is Crumb & { id: SiteRouteId } => crumb.id !== null
  );
  const current = linked[linked.length - 1];
  const url = current ? absoluteUrl(publicPath(current.id, lang)) : undefined;
  return {
    '@type': 'BreadcrumbList',
    '@id': url ? `${url}#breadcrumb` : undefined,
    inLanguage: lang,
    itemListElement: linked.map((crumb, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: crumbLabel(crumb, t),
      item: absoluteUrl(publicPath(crumb.id, lang)),
    })),
  };
}
