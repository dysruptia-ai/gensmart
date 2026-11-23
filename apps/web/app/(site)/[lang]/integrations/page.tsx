import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import SiteRoot from '@/components/site/SiteRoot';
import SkipLink from '@/components/site/SkipLink';
import AnnounceBar from '@/components/site/AnnounceBar';
import SiteHeader from '@/components/site/SiteHeader';
import SiteFooter from '@/components/site/SiteFooter';
import SiteChatWidget from '@/components/site/SiteChatWidget';
import FinalCtaSection from '@/components/site/home/FinalCtaSection';
import IntegrationsHero from '@/components/site/integrations/IntegrationsHero';
import WaysSection from '@/components/site/integrations/WaysSection';
import DirectorySection from '@/components/site/integrations/DirectorySection';
import { TOOL_CATEGORIES, categoryTitle } from '@/components/site/integrations/integrationsData';
import { INTEGRATIONS_CRUMBS, toolsCount } from '@/components/site/product/productData';
import { breadcrumbJsonLd } from '@/components/site/Breadcrumbs/crumbs';
import { siteT } from '@/lib/site-i18n';
import { sitePageMetadata } from '@/lib/site-metadata';
import { absoluteUrl, isSiteLanguage, publicPath, type SiteLanguage } from '@/lib/site-routes';

interface PageProps {
  params: Promise<{ lang: string }>;
}

async function resolveLang(params: PageProps['params']): Promise<SiteLanguage> {
  const { lang } = await params;
  if (!isSiteLanguage(lang)) notFound();
  return lang;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const lang = await resolveLang(params);
  const t = siteT(lang);
  return sitePageMetadata('integrations', lang, {
    title: t('site.meta.integrations.title'),
    description: t('site.meta.integrations.description', { tools: toolsCount(lang) }),
    ogAlt: t('site.meta.integrations.ogAlt'),
  });
}

export const viewport: Viewport = {
  themeColor: '#0c1014',
};

function buildJsonLd(lang: SiteLanguage) {
  const t = siteT(lang);
  const url = absoluteUrl(publicPath('integrations', lang));
  return {
    '@context': 'https://schema.org',
    '@graph': [
      breadcrumbJsonLd(INTEGRATIONS_CRUMBS, t, lang),
      {
        // El directorio visible: categorías con sus herramientas (solo nombres)
        '@type': 'ItemList',
        '@id': `${url}#directory`,
        name: t('site.integrations.dir.listName'),
        url,
        inLanguage: lang,
        numberOfItems: TOOL_CATEGORIES.length,
        itemListElement: TOOL_CATEGORIES.map((cat, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          item: {
            '@type': 'ItemList',
            name: categoryTitle(t, cat.key),
            numberOfItems: cat.tools.length,
            itemListElement: cat.tools.map((name, j) => ({
              '@type': 'ListItem',
              position: j + 1,
              name,
            })),
          },
        })),
      },
    ],
  };
}

export default async function IntegrationsPage({ params }: PageProps) {
  const lang = await resolveLang(params);

  return (
    <SiteRoot>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd(lang)) }}
      />
      <SkipLink />
      <AnnounceBar />
      <SiteHeader />
      <main id="main">
        <IntegrationsHero />
        <WaysSection />
        <DirectorySection />
        <FinalCtaSection />
      </main>
      <SiteFooter />
      <SiteChatWidget />
    </SiteRoot>
  );
}
