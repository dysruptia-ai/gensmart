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
  title: 'GenSmart — Build & Deploy AI Agents for WhatsApp & Web in Minutes',
  description:
    'No-code AI agent builder for WhatsApp & Web. Create intelligent chatbots with built-in CRM, lead scoring, sales funnel, and appointment scheduling. Deploy in minutes, not weeks. Start free.',
  keywords: [
    'AI agent builder',
    'WhatsApp AI chatbot',
    'no-code AI agent platform',
    'AI chatbot for small business',
    'WhatsApp Business automation',
    'AI-powered lead capture',
    'deploy AI agent in minutes',
    'conversational AI platform',
    'AI customer service chatbot',
    'chatbot builder with CRM',
    'WhatsApp chatbot no code',
    'AI sales agent',
    'automated customer support',
    'AI agent for WhatsApp Business',
    'build AI chatbot without coding',
  ],
  openGraph: {
    title: 'GenSmart — Build & Deploy AI Agents for WhatsApp & Web in Minutes',
    description:
      'No-code AI agent builder for WhatsApp & Web. Create intelligent chatbots with built-in CRM, lead scoring, sales funnel, and appointment scheduling. Deploy in minutes, not weeks.',
    url: 'https://www.gensmart.co',
    siteName: 'GenSmart',
    images: [
      {
        url: 'https://www.gensmart.co/og-image.png',
        width: 1200,
        height: 630,
        alt: 'GenSmart — AI Agents Platform',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GenSmart — Build & Deploy AI Agents for WhatsApp & Web in Minutes',
    description:
      'No-code AI agent builder for WhatsApp & Web. Create intelligent chatbots with built-in CRM, lead scoring, sales funnel, and appointment scheduling.',
    images: ['https://www.gensmart.co/og-image.png'],
  },
  alternates: {
    canonical: 'https://www.gensmart.co',
  },
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
