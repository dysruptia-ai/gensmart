import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing — GenSmart AI Agent Builder',
  description:
    'Compare GenSmart plans for your WhatsApp AI chatbot. Free forever plan, Starter at $29/mo, Pro at $79/mo, Enterprise at $199/mo. No-code AI agent builder with CRM, lead scoring, and appointment scheduling included.',
  openGraph: {
    title: 'GenSmart Pricing — AI Agent Builder for WhatsApp & Web',
    description:
      'Deploy AI chatbots in minutes. Plans from free to enterprise with built-in CRM and AI lead scoring.',
    url: 'https://www.gensmart.co/pricing',
    siteName: 'GenSmart',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'GenSmart Pricing Plans' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GenSmart Pricing — AI Chatbot Plans',
    description: 'Deploy AI chatbots in minutes. Plans from free to enterprise.',
    images: ['/twitter-card.png'],
  },
  alternates: {
    canonical: 'https://www.gensmart.co/pricing',
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
