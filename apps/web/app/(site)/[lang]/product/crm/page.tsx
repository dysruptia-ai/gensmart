import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import SubpageShell from '@/components/site/product/ProductSubpage/SubpageShell';
import { subpageMetadata } from '@/components/site/product/ProductSubpage/subpageMeta';
import CrmHero from '@/components/site/product/crm/CrmHero';
import CrmAuto from '@/components/site/product/crm/CrmAuto';
import CrmFunnel from '@/components/site/product/crm/CrmFunnel';
import CrmRecord from '@/components/site/product/crm/CrmRecord';
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
  return subpageMetadata('productCrm', await resolveLang(params));
}

export const viewport: Viewport = {
  themeColor: '#0c1014',
};

export default async function ProductCrmPage({ params }: PageProps) {
  const lang = await resolveLang(params);
  return (
    <SubpageShell id="productCrm" lang={lang} variants={['isInbox', 'isCrm']}>
      <CrmHero />
      <CrmAuto />
      <CrmFunnel />
      <CrmRecord />
    </SubpageShell>
  );
}
