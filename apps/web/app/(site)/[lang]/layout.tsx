import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { sora, geist } from '@/app/fonts/site';
import '@/app/fonts/fallbacks.css';
import '../site-base.css';
import { FixedLanguageProvider } from '@/contexts/LanguageContext';
import SiteDict from '@/components/site/SiteDict';
import { SITE_LANGUAGES, SITE_ORIGIN, isSiteLanguage } from '@/lib/site-routes';

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
        <FixedLanguageProvider language={lang}>
          <SiteDict lang={lang}>{children}</SiteDict>
        </FixedLanguageProvider>
      </body>
    </html>
  );
}
