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
import TeamsSection from '@/components/site/home/TeamsSection';
import HowItWorksSection from '@/components/site/home/HowItWorksSection';
import HandoffSection from '@/components/site/home/HandoffSection';
import IntegrationsSection from '@/components/site/home/IntegrationsSection';
import FiguresSection from '@/components/site/home/FiguresSection';
import PricingLadderSection from '@/components/site/home/PricingLadderSection';
import FaqSection from '@/components/site/home/FaqSection';
import FinalCtaSection from '@/components/site/home/FinalCtaSection';
import SiteChatWidget from '@/components/site/SiteChatWidget';

const TITLE = 'GenSmart | AI agents that sell and support, 24/7';
const DESCRIPTION =
  'Multichannel agentic platform. Create, connect and activate AI agents in 3 steps for WhatsApp, Instagram, Facebook, Telegram, email and your website.';
const OG_IMAGE = '/site/img/hero-motion-poster-en.webp';

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: 'https://www.gensmart.co',
    siteName: 'GenSmart',
    images: [{ url: OG_IMAGE, alt: 'GenSmart: AI agents that sell and support, 24/7' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
  alternates: {
    canonical: 'https://www.gensmart.co',
  },
};

export const viewport: Viewport = {
  themeColor: '#0c1014',
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': 'https://www.gensmart.co/#organization',
      name: 'GenSmart',
      url: 'https://www.gensmart.co',
      sameAs: [
        'https://twitter.com/gensmart_ai',
        'https://linkedin.com/company/gensmart-ai',
      ],
    },
    {
      '@type': 'SoftwareApplication',
      '@id': 'https://www.gensmart.co/#app',
      name: 'GenSmart',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web, WhatsApp',
      offers: {
        '@type': 'AggregateOffer',
        lowPrice: '0',
        highPrice: '199',
        priceCurrency: 'USD',
      },
      description:
        'All-in-one platform for creating and deploying AI conversational agents on WhatsApp and web.',
      publisher: { '@id': 'https://www.gensmart.co/#organization' },
    },
  ],
};

export default function LandingPage() {
  return (
    <SiteRoot>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SkipLink />
      <AnnounceBar />
      <SiteHeader />
      <main id="main" suppressHydrationWarning>
        <HeroSection />
        <ProblemSection />
        <PlatformSection />
        <CompareSection />
        <TeamsSection />
        <HowItWorksSection />
        <HandoffSection />
        <IntegrationsSection />
        <FiguresSection />
        <PricingLadderSection />
        <FaqSection />
        <FinalCtaSection />
      </main>
      <SiteFooter />
      <SiteChatWidget />
    </SiteRoot>
  );
}
