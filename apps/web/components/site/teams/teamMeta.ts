/** Metadatos y JSON-LD de las páginas de equipo (solo servidor). */
import type { Metadata } from 'next';
import { siteT } from '@/lib/site-i18n';
import { sitePageMetadata } from '@/lib/site-metadata';
import { absoluteUrl, publicPath, type SiteLanguage } from '@/lib/site-routes';
import { breadcrumbJsonLd } from '../Breadcrumbs/crumbs';
import { faqPageJsonLd } from '../FaqList/faq';
import { teamCrumbs, teamFaqItems, type TeamData } from './teamsData';

export function teamMetadata(team: TeamData, lang: SiteLanguage): Metadata {
  const t = siteT(lang);
  return sitePageMetadata(team.id, lang, {
    title: t(`site.meta.${team.id}.title`),
    description: t(`site.meta.${team.id}.description`),
    ogAlt: t(`site.meta.${team.id}.ogAlt`),
  });
}

/** `BreadcrumbList` (sin los niveles que aún no tienen URL) y `FAQPage`. */
export function teamJsonLd(team: TeamData, lang: SiteLanguage) {
  const t = siteT(lang);
  const url = absoluteUrl(publicPath(team.id, lang));
  return {
    '@context': 'https://schema.org',
    '@graph': [breadcrumbJsonLd(teamCrumbs(team.id), t, lang), faqPageJsonLd(teamFaqItems(team, t), url, lang)],
  };
}
