/**
 * Metadatos, migas y JSON-LD de las páginas legales (servidor).
 */
import type { Metadata } from 'next';
import type { LegalDoc } from '@/lib/legal';
import type { SiteT } from '@/lib/site-t';
import { sitePageMetadata } from '@/lib/site-metadata';
import { SITE_ORIGIN, absoluteUrl, publicPath, type SiteLanguage } from '@/lib/site-routes';
import { breadcrumbJsonLd, type Crumb } from '../Breadcrumbs/crumbs';

const ORGANIZATION = { '@type': 'Organization', '@id': `${SITE_ORIGIN}/#organization`, name: 'GenSmart' };

/** Fecha del sitio: "21 de marzo de 2026" / "March 21, 2026". */
export function formatLegalDate(iso: string, lang: SiteLanguage): string {
  const locale = lang === 'es' ? 'es' : 'en-US';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
}

/** Inicio › Legal › {documento}. "Legal" no tiene página propia (`/legal` redirige a Términos). */
export function legalCrumbs(doc: LegalDoc): Crumb[] {
  return [
    { id: 'home', labelKey: 'site.crumbs.home' },
    { id: null, labelKey: 'site.crumbs.legal' },
    { id: doc.route.routeId, labelKey: '', label: doc.title },
  ];
}

export function legalMetadata(doc: LegalDoc, lang: SiteLanguage): Metadata {
  return sitePageMetadata(doc.route.routeId, lang, {
    title: doc.seoTitle ?? `${doc.title} | GenSmart`,
    description: doc.description,
    ogAlt: doc.title,
  });
}

export function legalJsonLd(doc: LegalDoc, lang: SiteLanguage, t: SiteT): object {
  const url = absoluteUrl(publicPath(doc.route.routeId, lang));
  return {
    '@context': 'https://schema.org',
    '@graph': [
      breadcrumbJsonLd(legalCrumbs(doc), t, lang),
      {
        '@type': 'WebPage',
        '@id': `${url}#page`,
        url,
        name: doc.title,
        description: doc.description,
        inLanguage: lang,
        dateModified: doc.lastUpdated,
        publisher: ORGANIZATION,
        breadcrumb: { '@id': `${url}#breadcrumb` },
        isPartOf: { '@type': 'WebSite', '@id': `${SITE_ORIGIN}/#website`, url: `${SITE_ORIGIN}/`, name: 'GenSmart' },
      },
    ],
  };
}
