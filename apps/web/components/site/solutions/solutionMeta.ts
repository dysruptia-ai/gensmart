/** Metadatos y JSON-LD de las páginas de Soluciones (solo servidor). */
import type { Metadata } from 'next';
import { siteT } from '@/lib/site-i18n';
import { sitePageMetadata } from '@/lib/site-metadata';
import { absoluteUrl, publicPath, type SiteLanguage, type SiteRouteId } from '@/lib/site-routes';
import { breadcrumbJsonLd } from '../Breadcrumbs/crumbs';
import { faqPageJsonLd } from '../FaqList/faq';
import { solutionCrumbs, solutionFaqItems, type SolutionData } from './solutionsData';

/** Título, descripción y `ogAlt` de `site.meta.<id>`, con canonical y `hreflang`. */
export function solutionMetadata(id: SiteRouteId, lang: SiteLanguage): Metadata {
  const t = siteT(lang);
  return sitePageMetadata(id, lang, {
    title: t(`site.meta.${id}.title`),
    description: t(`site.meta.${id}.description`),
    ogAlt: t(`site.meta.${id}.ogAlt`),
  });
}

/** `BreadcrumbList` (Inicio → Soluciones → Página) y `FAQPage`. */
export function solutionJsonLd(page: SolutionData, lang: SiteLanguage) {
  const t = siteT(lang);
  const url = absoluteUrl(publicPath(page.id, lang));
  return {
    '@context': 'https://schema.org',
    '@graph': [breadcrumbJsonLd(solutionCrumbs(page.id), t, lang), faqPageJsonLd(solutionFaqItems(page, t), url, lang)],
  };
}
