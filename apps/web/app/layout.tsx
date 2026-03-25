import type { Metadata } from 'next';
import { Inter, Handjet } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ToastProvider } from '@/components/ui/Toast';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-family',
});

const handjet = Handjet({
  subsets: ['latin'],
  weight: ['700'],
  variable: '--font-logo',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://www.gensmart.co'),
  title: {
    default: 'GenSmart — AI Agent Builder for WhatsApp & Web | No-Code Chatbot Platform',
    template: '%s — GenSmart',
  },
  description:
    'Create and deploy AI chatbots for WhatsApp and Web in minutes, not weeks. No-code AI agent builder with built-in CRM, AI lead scoring, sales funnel, and appointment scheduling. The best WhatsApp chatbot platform for small businesses.',
  keywords: [
    'WhatsApp AI chatbot for business',
    'AI agent builder no-code',
    'deploy AI chatbot in minutes',
    'AI lead capture WhatsApp',
    'AI customer service automation',
    'WhatsApp CRM with AI scoring',
    'no-code chatbot builder WhatsApp',
    'AI appointment scheduling chatbot',
    'best WhatsApp chatbot platform 2026',
    'AI sales funnel automation',
    'chatbot IA para WhatsApp empresas',
    'creador de agentes IA sin código',
    'automatización servicio al cliente con IA',
    'plataforma chatbot WhatsApp',
  ],
  authors: [{ name: 'GenSmart by Dysruptia' }],
  creator: 'Dysruptia LLC',
  publisher: 'GenSmart',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    alternateLocale: 'es_ES',
    url: 'https://www.gensmart.co',
    siteName: 'GenSmart',
    title: 'GenSmart — AI Agent Builder for WhatsApp & Web',
    description:
      'Create and deploy AI chatbots for WhatsApp and Web in minutes. No-code platform with CRM, AI lead scoring, sales funnel, and appointment scheduling.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'GenSmart — AI Agent Builder for WhatsApp and Web',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GenSmart — AI Agent Builder for WhatsApp & Web',
    description:
      'Create and deploy AI chatbots for WhatsApp and Web in minutes. No-code platform with CRM, lead scoring, and scheduling.',
    images: ['/twitter-card.png'],
    creator: '@gaborgenner',
  },
  alternates: {
    canonical: 'https://www.gensmart.co',
  },
  category: 'SaaS',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${handjet.variable}`}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SoftwareApplication',
              name: 'GenSmart',
              applicationCategory: 'BusinessApplication',
              operatingSystem: 'Web',
              description:
                'No-code AI agent builder for WhatsApp and Web. Create and deploy AI chatbots with built-in CRM, lead scoring, sales funnel, and appointment scheduling.',
              url: 'https://www.gensmart.co',
              offers: [
                {
                  '@type': 'Offer',
                  price: '0',
                  priceCurrency: 'USD',
                  name: 'Free',
                  description: '1 agent, 50 messages/month, web only',
                },
                {
                  '@type': 'Offer',
                  price: '29',
                  priceCurrency: 'USD',
                  name: 'Starter',
                  description: '3 agents, 1,000 messages/month, WhatsApp + web',
                },
                {
                  '@type': 'Offer',
                  price: '79',
                  priceCurrency: 'USD',
                  name: 'Pro',
                  description: '10 agents, 5,000 messages/month, all AI models',
                },
                {
                  '@type': 'Offer',
                  price: '199',
                  priceCurrency: 'USD',
                  name: 'Enterprise',
                  description: 'Unlimited agents, 25,000 messages/month, BYO API key',
                },
              ],
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: '4.8',
                ratingCount: '124',
                bestRating: '5',
              },
              creator: {
                '@type': 'Organization',
                name: 'Dysruptia LLC',
                url: 'https://www.gensmart.co',
              },
            }),
          }}
        />
        <AuthProvider>
          <LanguageProvider>
            <ToastProvider>
              {children}
            </ToastProvider>
          </LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
