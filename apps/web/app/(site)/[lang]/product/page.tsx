import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import SiteRoot from '@/components/site/SiteRoot';
import SkipLink from '@/components/site/SkipLink';
import AnnounceBar from '@/components/site/AnnounceBar';
import SiteHeader from '@/components/site/SiteHeader';
import SiteFooter from '@/components/site/SiteFooter';
import SiteChatWidget from '@/components/site/SiteChatWidget';
import FinalCtaSection from '@/components/site/home/FinalCtaSection';
import ProductHero from '@/components/site/product/ProductHero';
import PlatformBento from '@/components/site/product/PlatformBento';
import ProductFigures from '@/components/site/product/ProductFigures';
import AgentsSection from '@/components/site/product/AgentsSection';
import InboxSection from '@/components/site/product/InboxSection';
import ConnectSection from '@/components/site/product/ConnectSection';
import SetupSteps from '@/components/site/product/SetupSteps';
import ProductFaq from '@/components/site/product/ProductFaq';
import {
  PRODUCT_CRUMBS,
  productFaqItems,
  productFeatures,
  productValues,
} from '@/components/site/product/productData';
import { breadcrumbJsonLd } from '@/components/site/Breadcrumbs/crumbs';
import { faqPageJsonLd } from '@/components/site/FaqList/faq';
import { siteT } from '@/lib/site-i18n';
import { sitePageMetadata } from '@/lib/site-metadata';
import { SITE_ORIGIN, absoluteUrl, isSiteLanguage, publicPath, type SiteLanguage } from '@/lib/site-routes';

interface PageProps {
  params: Promise<{ lang: string }>;
}

async function resolveLang(params: PageProps['params']): Promise<SiteLanguage> {
  const { lang } = await params;
  if (!isSiteLanguage(lang)) notFound();
  return lang;
}

function meta(lang: SiteLanguage) {
  const t = siteT(lang);
  return {
    title: t('site.meta.product.title'),
    description: t('site.meta.product.description', productValues(t, lang)),
    ogAlt: t('site.meta.product.ogAlt'),
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const lang = await resolveLang(params);
  return sitePageMetadata('product', lang, meta(lang));
}

export const viewport: Viewport = {
  themeColor: '#0c1014',
};

function buildJsonLd(lang: SiteLanguage) {
  const t = siteT(lang);
  const url = absoluteUrl(publicPath('product', lang));
  return {
    '@context': 'https://schema.org',
    '@graph': [
      breadcrumbJsonLd(PRODUCT_CRUMBS, t, lang),
      faqPageJsonLd(productFaqItems(t, lang), url, lang),
      {
        // Sin ofertas: los precios están en la página de Precios
        '@type': 'SoftwareApplication',
        '@id': `${url}#app`,
        name: 'GenSmart',
        url,
        description: meta(lang).description,
        inLanguage: lang,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        featureList: productFeatures(t),
        publisher: { '@id': `${SITE_ORIGIN}/#organization` },
      },
    ],
  };
}

export default async function ProductPage({ params }: PageProps) {
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
        <ProductHero />
        <PlatformBento />
        <ProductFigures />
        <AgentsSection />
        <InboxSection />
        <ConnectSection />
        <SetupSteps />
        <ProductFaq />
        <FinalCtaSection />
      </main>
      <SiteFooter />
      <SiteChatWidget />
    </SiteRoot>
  );
}
