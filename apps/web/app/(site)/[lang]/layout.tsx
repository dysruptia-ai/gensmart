import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Sora, Geist } from 'next/font/google';
import '../site-base.css';
import { FixedLanguageProvider } from '@/contexts/LanguageContext';
import { SITE_LANGUAGES, SITE_ORIGIN, isSiteLanguage } from '@/lib/site-routes';

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
  metadataBase: new URL(SITE_ORIGIN),
};

export const dynamicParams = false;

export function generateStaticParams() {
  return SITE_LANGUAGES.map((lang) => ({ lang }));
}

export default async function SiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isSiteLanguage(lang)) notFound();

  return (
    <html lang={lang} className={`${sora.variable} ${geist.variable}`}>
      <body>
        <FixedLanguageProvider language={lang}>{children}</FixedLanguageProvider>
      </body>
    </html>
  );
}
