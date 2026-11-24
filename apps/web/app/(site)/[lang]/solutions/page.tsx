import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import SolutionShell from '@/components/site/solutions/SolutionShell';
import SolutionsIndexPage from '@/components/site/solutions/SolutionsIndexPage';
import { solutionMetadata } from '@/components/site/solutions/solutionMeta';
import { solutionsIndexJsonLd } from '@/components/site/solutions/solutionsIndex';
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
  return solutionMetadata('solutions', await resolveLang(params));
}

export const viewport: Viewport = {
  themeColor: '#0c1014',
};

export default async function SolutionsPage({ params }: PageProps) {
  const lang = await resolveLang(params);
  return (
    <SolutionShell jsonLd={solutionsIndexJsonLd(siteT(lang), lang)}>
      <SolutionsIndexPage />
    </SolutionShell>
  );
}
