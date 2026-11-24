import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import PartnersPage from '@/components/site/partners/PartnersPage';
import { partnersJsonLd, programValues } from '@/components/site/partners/partnersData';
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
  const v = programValues(t, lang);
  return sitePageMetadata('partners', lang, {
    title: t('site.meta.partners.title', v),
    description: t('site.meta.partners.description', v),
    ogAlt: t('site.meta.partners.ogAlt'),
  });
}

export const viewport: Viewport = {
  themeColor: '#0c1014',
};

/** Programa de socios: `/partners` y `/en/partners`. */
export default async function PartnersRoute({ params }: PageProps) {
  const lang = await resolveLang(params);
  const t = siteT(lang);
  return (
    <SolutionShell
      jsonLd={partnersJsonLd(t, lang)}
      cta={{
        titleBefore: t('site.partners.cta.titleBefore'),
        titleAccent: t('site.partners.cta.titleAccent'),
        lead: t('site.partners.cta.lead'),
        primaryLabel: t('site.partners.cta.primary'),
        primaryTo: 'partnerSignup',
        showDemo: false,
      }}
    >
      <PartnersPage />
    </SolutionShell>
  );
}
