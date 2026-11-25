import type { Metadata } from 'next';
import { Inter, Handjet, Sora, Geist } from 'next/font/google';
import './platform.css';
import './gs-tokens.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ToastProvider } from '@/components/ui/Toast';
import { APP_BOOT_SCRIPT } from '@/lib/app-theme';

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

const sora = Sora({
  subsets: ['latin'],
  weight: ['600', '700'],
  display: 'swap',
  variable: '--font-sora',
});

const geist = Geist({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-geist',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://www.gensmart.co'),
  title: {
    default: 'GenSmart | Multichannel agentic platform for AI agents',
    template: '%s | GenSmart',
  },
  description:
    'Multichannel agentic platform. Create, connect and activate AI agents in 3 steps for WhatsApp, Instagram, Messenger, Telegram, email and your website.',
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
    alternateLocale: 'es_LA',
    siteName: 'GenSmart',
    title: 'GenSmart | Multichannel agentic platform for AI agents',
    description:
      'Multichannel agentic platform. Create, connect and activate AI agents in 3 steps for WhatsApp, Instagram, Messenger, Telegram, email and your website.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'GenSmart: multichannel agentic platform for AI agents',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GenSmart | Multichannel agentic platform for AI agents',
    description:
      'Multichannel agentic platform. Create, connect and activate AI agents in 3 steps for WhatsApp, Instagram, Messenger, Telegram, email and your website.',
    images: ['/twitter-card.png'],
    creator: '@gaborgenner',
  },
  category: 'SaaS',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // `lang` y `data-gs-theme` los ajusta APP_BOOT_SCRIPT antes del primer pintado (y luego
    // LanguageProvider): por eso <html> no se compara al hidratar.
    <html
      lang="en"
      className={`${inter.variable} ${handjet.variable} ${sora.variable} ${geist.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: APP_BOOT_SCRIPT }} />
      </head>
      <body>
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
