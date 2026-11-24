import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import IndustryPage from '@/components/site/industries/IndustryPage';
import { INDUSTRY_SLUGS, industryBySlug, type IndustryData } from '@/components/site/industries/industriesData';
import SolutionShell from '@/components/site/solutions/SolutionShell';
import { solutionJsonLd, solutionMetadata } from '@/components/site/solutions/solutionMeta';
import { SITE_LANGUAGES, isSiteLanguage, type SiteLanguage } from '@/lib/site-routes';

interface PageProps {
  params: Promise<{ lang: string; industry: string }>;
}

/** Slug desconocido: 404 (no se generan páginas fuera de la lista). */
export const dynamicParams = false;

export function generateStaticParams() {
  return SITE_LANGUAGES.flatMap((lang) => INDUSTRY_SLUGS.map((industry) => ({ lang, industry })));
}

async function resolve(params: PageProps['params']): Promise<{ lang: SiteLanguage; industry: IndustryData }> {
  const { lang, industry: slug } = await params;
  const industry = industryBySlug(slug);
  if (!isSiteLanguage(lang) || !industry) notFound();
  return { lang, industry };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang, industry } = await resolve(params);
  return solutionMetadata(industry.id, lang);
}

export const viewport: Viewport = {
  themeColor: '#0c1014',
};

export default async function IndustrySolutionPage({ params }: PageProps) {
  const { lang, industry } = await resolve(params);
  return (
    <SolutionShell jsonLd={solutionJsonLd(industry, lang)}>
      <IndustryPage industry={industry} />
    </SolutionShell>
  );
}
