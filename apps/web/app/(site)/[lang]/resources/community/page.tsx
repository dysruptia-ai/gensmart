import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import CommunityPage from '@/components/site/resources/CommunityPage';
import { communityJsonLd } from '@/components/site/resources/resourcesData';
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
  return sitePageMetadata('community', lang, {
    title: t('site.meta.community.title'),
    description: t('site.meta.community.description'),
    ogAlt: t('site.meta.community.ogAlt'),
  });
}

export const viewport: Viewport = {
  themeColor: '#0c1014',
};

/** Comunidad: `/recursos/comunidad` y `/en/resources/community`. */
export default async function CommunityRoute({ params }: PageProps) {
  const lang = await resolveLang(params);
  return (
    <SolutionShell jsonLd={communityJsonLd(siteT(lang), lang)}>
      <CommunityPage />
    </SolutionShell>
  );
}
