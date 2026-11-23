/** Metadatos y JSON-LD de las subpáginas de Producto (solo servidor). */
import type { Metadata } from 'next';
import { siteT } from '@/lib/site-i18n';
import { sitePageMetadata } from '@/lib/site-metadata';
import type { SiteLanguage } from '@/lib/site-routes';
import { breadcrumbJsonLd } from '../../Breadcrumbs/crumbs';
import { subpageCrumbs, subpageValues, type ProductSubpageId } from './subpageData';

export function subpageMeta(id: ProductSubpageId, lang: SiteLanguage) {
  const t = siteT(lang);
  const values = subpageValues(lang);
  return {
    title: t(`site.meta.${id}.title`, values),
    description: t(`site.meta.${id}.description`, values),
    ogAlt: t(`site.meta.${id}.ogAlt`, values),
  };
}

export function subpageMetadata(id: ProductSubpageId, lang: SiteLanguage): Metadata {
  return sitePageMetadata(id, lang, subpageMeta(id, lang));
}

/** Solo `BreadcrumbList` (Inicio / Producto / Página), con `inLanguage`. */
export function subpageJsonLd(id: ProductSubpageId, lang: SiteLanguage) {
  return {
    '@context': 'https://schema.org',
    '@graph': [breadcrumbJsonLd(subpageCrumbs(id), siteT(lang), lang)],
  };
}
