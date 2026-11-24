import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import EcommercePage from '@/components/site/ecommerce/EcommercePage';
import { E, ecommerceJsonLd } from '@/components/site/ecommerce/ecommerceData';
import SolutionShell from '@/components/site/solutions/SolutionShell';
import { solutionMetadata } from '@/components/site/solutions/solutionMeta';
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
  return solutionMetadata('ecommerce', await resolveLang(params));
}

export const viewport: Viewport = {
  themeColor: '#0c1014',
};

/** Landing E-commerce: `/soluciones/ecommerce` y `/en/solutions/ecommerce`. */
export default async function EcommerceSolutionPage({ params }: PageProps) {
  const lang = await resolveLang(params);
  const t = siteT(lang);
  return (
    <SolutionShell
      jsonLd={ecommerceJsonLd(t, lang)}
      cta={{
        titleBefore: t(`${E}.cta.titleBefore`),
        titleAccent: t(`${E}.cta.titleAccent`),
        lead: t(`${E}.cta.lead`),
      }}
    >
      <EcommercePage />
    </SolutionShell>
  );
}
