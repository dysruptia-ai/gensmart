import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import SiteRoot from '@/components/site/SiteRoot';
import SkipLink from '@/components/site/SkipLink';
import AnnounceBar from '@/components/site/AnnounceBar';
import SiteHeader from '@/components/site/SiteHeader';
import SiteFooter from '@/components/site/SiteFooter';
import SiteChatWidget from '@/components/site/SiteChatWidget';
import FinalCtaSection from '@/components/site/home/FinalCtaSection';
import PricingHero from '@/components/site/pricing/PricingHero';
import PlansSection from '@/components/site/pricing/PlansSection';
import CompareTable from '@/components/site/pricing/CompareTable';
import PacksSection from '@/components/site/pricing/PacksSection';
import PricingFaq from '@/components/site/pricing/PricingFaq';
import AgencyBanner from '@/components/site/pricing/AgencyBanner';
import {
  PLAN_IDS,
  PLAN_NAMES,
  PRICING_CRUMBS,
  YEARLY_DISCOUNT_PERCENT,
  faqItems,
} from '@/components/site/pricing/pricingData';
import { breadcrumbJsonLd } from '@/components/site/Breadcrumbs/crumbs';
import { faqPageJsonLd } from '@/components/site/FaqList/faq';
import { SITE_TRIAL_DAYS } from '@/components/site/siteTrial';
import { PRICING } from '@gensmart/shared';
import { siteT } from '@/lib/site-i18n';
import {
  SITE_ORIGIN,
  absoluteUrl,
  alternates,
  isSiteLanguage,
  otherLanguage,
  publicPath,
  type SiteLanguage,
} from '@/lib/site-routes';

const OG_LOCALE: Record<SiteLanguage, string> = { es: 'es_LA', en: 'en_US' };

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
    title: t('site.meta.pricing.title'),
    description: t('site.meta.pricing.description', {
      discount: YEARLY_DISCOUNT_PERCENT,
      days: SITE_TRIAL_DAYS,
    }),
    ogAlt: t('site.meta.pricing.ogAlt'),
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const lang = await resolveLang(params);
  const { title, description, ogAlt } = meta(lang);
  const url = absoluteUrl(publicPath('pricing', lang));
  const ogImage = `/site/img/hero-motion-poster-${lang}.webp`;

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url, languages: alternates('pricing') },
    openGraph: {
      type: 'website',
      siteName: 'GenSmart',
      title,
      description,
      url,
      locale: OG_LOCALE[lang],
      alternateLocale: [OG_LOCALE[otherLanguage(lang)]],
      images: [{ url: ogImage, alt: ogAlt }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  };
}

export const viewport: Viewport = {
  themeColor: '#0c1014',
};

function buildJsonLd(lang: SiteLanguage) {
  const t = siteT(lang);
  const url = absoluteUrl(publicPath('pricing', lang));
  const { description } = meta(lang);
  return {
    '@context': 'https://schema.org',
    '@graph': [
      breadcrumbJsonLd(PRICING_CRUMBS, t, lang),
      faqPageJsonLd(faqItems(t, lang), url, lang),
      {
        '@type': 'SoftwareApplication',
        '@id': `${url}#app`,
        name: 'GenSmart',
        url,
        description,
        inLanguage: lang,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        publisher: { '@id': `${SITE_ORIGIN}/#organization` },
        offers: PLAN_IDS.map((id) => ({
          '@type': 'Offer',
          name: PLAN_NAMES[id],
          url,
          price: String(PRICING[id].monthly),
          priceCurrency: 'USD',
          priceSpecification: {
            '@type': 'UnitPriceSpecification',
            price: String(PRICING[id].monthly),
            priceCurrency: 'USD',
            unitCode: 'MON',
          },
        })),
      },
    ],
  };
}

export default async function PricingPage({ params }: PageProps) {
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
        <PricingHero />
        <PlansSection />
        <CompareTable />
        <PacksSection />
        <PricingFaq />
        <AgencyBanner />
        <FinalCtaSection />
      </main>
      <SiteFooter />
      <SiteChatWidget />
    </SiteRoot>
  );
}
