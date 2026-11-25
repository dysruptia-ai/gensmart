import type { Metadata, Viewport } from 'next';
import SiteRoot from '@/components/site/SiteRoot';
import SkipLink from '@/components/site/SkipLink';
import AnnounceBar from '@/components/site/AnnounceBar';
import SiteHeader from '@/components/site/SiteHeader';
import SiteFooter from '@/components/site/SiteFooter';
import HeroSection from '@/components/site/home/HeroSection';
import ProblemSection from '@/components/site/home/ProblemSection';
import PlatformSection from '@/components/site/home/PlatformSection';
import CompareSection from '@/components/site/home/CompareSection';
import UseCasesSection from '@/components/site/home/UseCasesSection';
import TeamsSection from '@/components/site/home/TeamsSection';
import HowItWorksSection from '@/components/site/home/HowItWorksSection';
import IntegrationsSection from '@/components/site/home/IntegrationsSection';
import PricingLadderSection from '@/components/site/home/PricingLadderSection';
import FinalCtaSection from '@/components/site/home/FinalCtaSection';
import SiteChatWidget from '@/components/site/SiteChatWidget';
import { notFound } from 'next/navigation';
import { PRICING } from '@gensmart/shared';
import { SITE_LINKS } from '@/lib/site-links';
import {
  SITE_ORIGIN,
  absoluteUrl,
  alternates,
  isSiteLanguage,
  otherLanguage,
  publicPath,
  type SiteLanguage,
} from '@/lib/site-routes';
import en from '@/i18n/site/en.json';
import es from '@/i18n/site/es.json';

const META: Record<SiteLanguage, typeof en.site.meta.home> = {
  en: en.site.meta.home,
  es: es.site.meta.home,
};

const OG_LOCALE: Record<SiteLanguage, string> = { es: 'es_LA', en: 'en_US' };

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
  const { title, description, ogAlt } = META[lang];
  const url = absoluteUrl(publicPath('home', lang));
  const languages = alternates('home');
  const ogImage = `/site/img/hero-motion-poster-${lang}.webp`;

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url, languages },
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

const OFFER_PLANS = [
  { id: 'solo', name: 'Solo' },
  { id: 'starter', name: 'Starter' },
  { id: 'pro', name: 'Pro' },
  { id: 'enterprise', name: 'Enterprise' },
] as const;

const SOCIAL_KEYS = ['socialInstagram', 'socialTiktok', 'socialYoutube', 'socialFacebook'] as const;

function buildJsonLd(lang: SiteLanguage) {
  const url = absoluteUrl(publicPath('home', lang));
  const { description } = META[lang];
  const orgId = `${SITE_ORIGIN}/#organization`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': orgId,
        name: 'GenSmart',
        url: `${SITE_ORIGIN}/`,
        logo: `${SITE_ORIGIN}/android-chrome-512x512.png`,
        sameAs: SOCIAL_KEYS.map((key) => SITE_LINKS[key].href).filter(
          (href): href is string => href !== null
        ),
      },
      {
        '@type': 'WebSite',
        '@id': `${url}#website`,
        name: 'GenSmart',
        url,
        inLanguage: lang,
        publisher: { '@id': orgId },
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${url}#app`,
        name: 'GenSmart',
        url,
        description,
        inLanguage: lang,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        offers: OFFER_PLANS.map((plan) => ({
          '@type': 'Offer',
          name: plan.name,
          price: String(PRICING[plan.id].monthly),
          priceCurrency: 'USD',
          priceSpecification: {
            '@type': 'UnitPriceSpecification',
            price: String(PRICING[plan.id].monthly),
            priceCurrency: 'USD',
            unitCode: 'MON',
          },
        })),
        publisher: { '@id': orgId },
      },
    ],
  };
}

export default async function LandingPage({ params }: PageProps) {
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
      <main id="main" suppressHydrationWarning>
        <HeroSection />
        <ProblemSection />
        <PlatformSection />
        <UseCasesSection />
        <TeamsSection />
        <HowItWorksSection />
        <CompareSection />
        <IntegrationsSection />
        <PricingLadderSection />
        <FinalCtaSection />
      </main>
      <SiteFooter />
      <SiteChatWidget />
    </SiteRoot>
  );
}
