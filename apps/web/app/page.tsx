import type { Metadata } from 'next';
import { PublicNavbar } from '@/components/layout/PublicNavbar';
import { Footer } from '@/components/layout/Footer';
import { HeroSection } from '@/components/landing/HeroSection';
import { SocialProofBar } from '@/components/landing/SocialProofBar';
import { ProblemSolution } from '@/components/landing/ProblemSolution';
import { FeaturesGrid } from '@/components/landing/FeaturesGrid';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { ChannelsSection } from '@/components/landing/ChannelsSection';
import { CRMPreview } from '@/components/landing/CRMPreview';
import { PricingSection } from '@/components/landing/PricingSection';
import { TestimonialsSection } from '@/components/landing/TestimonialsSection';
import { BlogPreview } from '@/components/landing/BlogPreview';
import { FAQ } from '@/components/landing/FAQ';
import { FinalCTA } from '@/components/landing/FinalCTA';

export const metadata: Metadata = {
  title: 'GenSmart — Create & Deploy AI Agents for WhatsApp & Web',
  description:
    'Build intelligent WhatsApp & Web chatbots with built-in CRM, sales funnel, and scheduling — no coding required. Start free in minutes.',
  keywords: [
    'AI agents',
    'WhatsApp chatbot',
    'AI automation',
    'lead scoring',
    'CRM',
    'chatbot builder',
    'WhatsApp Business',
    'conversational AI',
  ],
  openGraph: {
    title: 'GenSmart — Create & Deploy AI Agents for WhatsApp & Web',
    description:
      'Build intelligent WhatsApp & Web chatbots with built-in CRM, sales funnel, and scheduling — no coding required.',
    url: 'https://gensmart.ai',
    siteName: 'GenSmart',
    images: [
      {
        url: 'https://gensmart.ai/og-image.png',
        width: 1200,
        height: 630,
        alt: 'GenSmart — AI Agents Platform',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GenSmart — Create & Deploy AI Agents for WhatsApp & Web',
    description:
      'Build intelligent WhatsApp & Web chatbots with built-in CRM, sales funnel, and scheduling.',
    images: ['https://gensmart.ai/og-image.png'],
  },
  alternates: {
    canonical: 'https://gensmart.ai',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': 'https://gensmart.ai/#organization',
      name: 'GenSmart',
      url: 'https://gensmart.ai',
      sameAs: [
        'https://twitter.com/gensmart_ai',
        'https://linkedin.com/company/gensmart-ai',
      ],
    },
    {
      '@type': 'SoftwareApplication',
      '@id': 'https://gensmart.ai/#app',
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
      publisher: { '@id': 'https://gensmart.ai/#organization' },
    },
  ],
};

export default function LandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PublicNavbar />
      <main style={{ paddingTop: '72px' }}>
        <HeroSection />
        <SocialProofBar />
        <ProblemSolution />
        <FeaturesGrid />
        <HowItWorks />
        <ChannelsSection />
        <CRMPreview />
        <PricingSection />
        <TestimonialsSection />
        <BlogPreview />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
