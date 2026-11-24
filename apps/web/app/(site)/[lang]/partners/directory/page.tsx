import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import PartnerDirectoryPage from '@/components/site/partners/PartnerDirectoryPage';
import { directoryJsonLd } from '@/components/site/partners/partnersData';
import { solutionMetadata } from '@/components/site/solutions/solutionMeta';
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
  return solutionMetadata('partnersDirectory', await resolveLang(params));
}

export const viewport: Viewport = {
  themeColor: '#0c1014',
};

/** Directorio de partners: `/partners/directorio` y `/en/partners/directory`. Sin CTA final (el diseño cierra con la banda). */
export default async function PartnerDirectoryRoute({ params }: PageProps) {
  const lang = await resolveLang(params);
  return (
    <SolutionShell jsonLd={directoryJsonLd(siteT(lang), lang)} cta={false}>
      <PartnerDirectoryPage />
    </SolutionShell>
  );
}
