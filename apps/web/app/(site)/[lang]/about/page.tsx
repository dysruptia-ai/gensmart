import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import AboutPage, { aboutCrumbs } from '@/components/site/about/AboutPage';
import { breadcrumbJsonLd } from '@/components/site/Breadcrumbs/crumbs';
import SolutionShell from '@/components/site/solutions/SolutionShell';
import { siteT } from '@/lib/site-i18n';
import { sitePageMetadata } from '@/lib/site-metadata';
import { SITE_LANGUAGES, isSiteLanguage, type SiteLanguage } from '@/lib/site-routes';

interface PageProps {
  params: Promise<{ lang: string }>;
}

export function generateStaticParams() {
  return SITE_LANGUAGES.map((lang) => ({ lang }));
}

async function resolve(params: PageProps['params']): Promise<SiteLanguage> {
  const { lang } = await params;
  if (!isSiteLanguage(lang)) notFound();
  return lang;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const lang = await resolve(params);
  const t = siteT(lang);
  return {
    ...sitePageMetadata('about', lang, {
      title: t('site.meta.about.title'),
      description: t('site.meta.about.description'),
      ogAlt: t('site.meta.about.ogAlt'),
    }),
    // Marcador sin contenido: fuera del índice y del sitemap hasta que llegue la página
    robots: { index: false, follow: true },
  };
}

export const viewport: Viewport = {
  themeColor: '#0c1014',
};

/** Acerca de: `/acerca-de` y `/en/about` (marcador, noindex). */
export default async function AboutRoute({ params }: PageProps) {
  const lang = await resolve(params);
  const t = siteT(lang);
  const jsonLd = { '@context': 'https://schema.org', '@graph': [breadcrumbJsonLd(aboutCrumbs, t, lang)] };
  return (
    <SolutionShell jsonLd={jsonLd} cta={false}>
      <AboutPage lang={lang} />
    </SolutionShell>
  );
}
