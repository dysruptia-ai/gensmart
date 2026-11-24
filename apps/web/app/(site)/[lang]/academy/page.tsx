import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import AcademyIndexPage from '@/components/site/academy/AcademyIndexPage';
import { academyIndexJsonLd, academyIndexMetadata } from '@/components/site/academy/academyContent';
import SolutionShell from '@/components/site/solutions/SolutionShell';
import { siteT } from '@/lib/site-i18n';
import { isSiteLanguage, type SiteLanguage } from '@/lib/site-routes';

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
  return academyIndexMetadata(lang, siteT(lang));
}

export const viewport: Viewport = {
  themeColor: '#0c1014',
};

/** Academy: `/academia` y `/en/academy`. */
export default async function AcademyRoute({ params }: PageProps) {
  const lang = await resolveLang(params);
  return (
    <SolutionShell jsonLd={academyIndexJsonLd(lang, siteT(lang))}>
      <AcademyIndexPage lang={lang} />
    </SolutionShell>
  );
}
