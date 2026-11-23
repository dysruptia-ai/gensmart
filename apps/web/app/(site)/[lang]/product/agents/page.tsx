import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import SubpageShell from '@/components/site/product/ProductSubpage/SubpageShell';
import { subpageMetadata } from '@/components/site/product/ProductSubpage/subpageMeta';
import AgentsHero from '@/components/site/product/agents/AgentsHero';
import AgentsStart from '@/components/site/product/agents/AgentsStart';
import AgentsTeach from '@/components/site/product/agents/AgentsTeach';
import AgentsSteps from '@/components/site/product/agents/AgentsSteps';
import AgentsGuides from '@/components/site/product/agents/AgentsGuides';
import AgentsWhere from '@/components/site/product/agents/AgentsWhere';
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
  return subpageMetadata('productAgents', await resolveLang(params));
}

export const viewport: Viewport = {
  themeColor: '#0c1014',
};

export default async function ProductAgentsPage({ params }: PageProps) {
  const lang = await resolveLang(params);
  return (
    <SubpageShell id="productAgents" lang={lang} variants={['isAgents']}>
      <AgentsHero />
      <AgentsStart />
      <AgentsTeach />
      <AgentsSteps />
      <AgentsGuides />
      <AgentsWhere />
    </SubpageShell>
  );
}
