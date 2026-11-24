import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import ResourcesPage from '@/components/site/resources/ResourcesPage';
import { resourcesJsonLd } from '@/components/site/resources/resourcesData';
import SolutionShell from '@/components/site/solutions/SolutionShell';
import { siteT } from '@/lib/site-i18n';
import { sitePageMetadata } from '@/lib/site-metadata';
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
  const t = siteT(lang);
  return sitePageMetadata('resources', lang, {
    title: t('site.meta.resources.title'),
    description: t('site.meta.resources.description'),
    ogAlt: t('site.meta.resources.ogAlt'),
  });
}

export const viewport: Viewport = {
  themeColor: '#0c1014',
};

/** Centro de recursos: `/recursos` y `/en/resources`. */
export default async function ResourcesRoute({ params }: PageProps) {
  const lang = await resolveLang(params);
  return (
    <SolutionShell jsonLd={resourcesJsonLd(siteT(lang), lang)}>
      <ResourcesPage />
    </SolutionShell>
  );
}
