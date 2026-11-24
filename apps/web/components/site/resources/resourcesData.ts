/**
 * Recursos (`/recursos`) y Comunidad (`/recursos/comunidad`) (design/web: `recursos`
 * y `comunidad`). Los textos van en `site.resources.*` y `site.community.*`. Sin
 * `'use client'`: las páginas arman con esto los metadatos y el JSON-LD en el servidor.
 */
import type { SiteT } from '@/lib/site-i18n';
import { SITE_LINKS } from '@/lib/site-links';
import { absoluteUrl, publicPath, type SiteLanguage } from '@/lib/site-routes';
import { breadcrumbJsonLd, type Crumb } from '../Breadcrumbs/crumbs';
import { faqPageJsonLd, type FaqItem } from '../FaqList/faq';

export const R = 'site.resources';
export const C = 'site.community';

export const RESOURCES_CRUMBS: readonly Crumb[] = [
  { id: 'home', labelKey: 'site.crumbs.home' },
  { id: 'resources', labelKey: 'site.crumbs.resources' },
];

export const COMMUNITY_CRUMBS: readonly Crumb[] = [
  ...RESOURCES_CRUMBS,
  { id: 'community', labelKey: 'site.crumbs.community' },
];

export type ResourceSection = 'docs' | 'academy' | 'blog' | 'cases' | 'community';

/** Anclas de las 5 secciones, traducidas en EN donde aplica (como en Soluciones). */
export const SECTION_IDS: Record<ResourceSection, Record<SiteLanguage, string>> = {
  docs: { es: 'docs', en: 'docs' },
  academy: { es: 'academy', en: 'academy' },
  blog: { es: 'blog', en: 'blog' },
  cases: { es: 'casos', en: 'use-cases' },
  community: { es: 'comunidad', en: 'community' },
};

/** Ancla de "Un solo lugar, un grupo para cada tema" en Comunidad. */
export const HOW_ID: Record<SiteLanguage, string> = { es: 'como', en: 'how' };

const SECTIONS: readonly ResourceSection[] = ['docs', 'academy', 'blog', 'cases', 'community'];

/** URL de la página de cada sección; solo las que ya existen. */
function sectionUrl(section: ResourceSection, lang: SiteLanguage): string | undefined {
  if (section === 'docs') return absoluteUrl(publicPath('docs', lang));
  if (section === 'academy') return absoluteUrl(publicPath('academy', lang));
  if (section === 'cases') return absoluteUrl(publicPath('cases', lang));
  if (section === 'community') return absoluteUrl(publicPath('community', lang));
  if (section === 'blog' && SITE_LINKS.blog.href) return absoluteUrl(SITE_LINKS.blog.href);
  return undefined;
}

/** Recursos: `BreadcrumbList` y `CollectionPage` con las 5 secciones en `hasPart`. */
export function resourcesJsonLd(t: SiteT, lang: SiteLanguage) {
  const url = absoluteUrl(publicPath('resources', lang));
  return {
    '@context': 'https://schema.org',
    '@graph': [
      breadcrumbJsonLd(RESOURCES_CRUMBS, t, lang),
      {
        '@type': 'CollectionPage',
        '@id': `${url}#collection`,
        url,
        name: t('site.meta.resources.title'),
        description: t('site.meta.resources.description'),
        inLanguage: lang,
        breadcrumb: { '@id': `${url}#breadcrumb` },
        hasPart: SECTIONS.map((section) => {
          const partUrl = sectionUrl(section, lang);
          return {
            '@type': 'WebPage',
            name: t(`${R}.${section}.name`),
            description: t(`${R}.${section}.lead`),
            ...(partUrl ? { url: partUrl } : {}),
          };
        }),
      },
    ],
  };
}

export const COMMUNITY_FAQ_COUNT = 3;

export function communityFaqItems(t: SiteT): FaqItem[] {
  return Array.from({ length: COMMUNITY_FAQ_COUNT }, (_, i) => ({
    question: t(`${C}.not.faq.${i}.question`),
    answer: t(`${C}.not.faq.${i}.answer`),
  }));
}

/** Comunidad: `BreadcrumbList` y `FAQPage` con el mismo texto del `dl`. */
export function communityJsonLd(t: SiteT, lang: SiteLanguage) {
  const url = absoluteUrl(publicPath('community', lang));
  return {
    '@context': 'https://schema.org',
    '@graph': [breadcrumbJsonLd(COMMUNITY_CRUMBS, t, lang), faqPageJsonLd(communityFaqItems(t), url, lang)],
  };
}
