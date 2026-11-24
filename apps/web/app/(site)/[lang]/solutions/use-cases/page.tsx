import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import SolutionShell from '@/components/site/solutions/SolutionShell';
import { solutionMetadata } from '@/components/site/solutions/solutionMeta';
import UseCasesPage from '@/components/site/useCases/UseCasesPage';
import { casesJsonLd } from '@/components/site/useCases/useCasesData';
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
  return solutionMetadata('cases', await resolveLang(params));
}

export const viewport: Viewport = {
  themeColor: '#0c1014',
};

/** Casos de uso: `/soluciones/casos-de-uso` y `/en/solutions/use-cases`. */
export default async function UseCasesSolutionPage({ params }: PageProps) {
  const lang = await resolveLang(params);
  return (
    <SolutionShell jsonLd={casesJsonLd(siteT(lang), lang)}>
      <UseCasesPage />
    </SolutionShell>
  );
}
