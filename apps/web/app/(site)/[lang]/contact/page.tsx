import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import SiteRoot from '@/components/site/SiteRoot';
import SkipLink from '@/components/site/SkipLink';
import AnnounceBar from '@/components/site/AnnounceBar';
import SiteHeader from '@/components/site/SiteHeader';
import SiteFooter from '@/components/site/SiteFooter';
import SiteChatWidget from '@/components/site/SiteChatWidget';
import FinalCtaSection from '@/components/site/home/FinalCtaSection';
import ContactContent from '@/components/site/contact/ContactContent';
import { CONTACT_CRUMBS } from '@/components/site/contact/contactData';
import { SITE_TRIAL_DAYS } from '@/components/site/siteTrial';
import { breadcrumbJsonLd } from '@/components/site/Breadcrumbs/crumbs';
import { siteT } from '@/lib/site-i18n';
import { sitePageMetadata } from '@/lib/site-metadata';
import { SITE_ORIGIN, absoluteUrl, isSiteLanguage, publicPath, type SiteLanguage } from '@/lib/site-routes';

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
  // Canonical sin query: las variantes `?tipo=` apuntan a la versión base
  return sitePageMetadata('contact', lang, {
    title: t('site.meta.contact.title'),
    description: t('site.meta.contact.description'),
    ogAlt: t('site.meta.contact.ogAlt'),
  });
}

export const viewport: Viewport = {
  themeColor: '#0c1014',
};

function buildJsonLd(lang: SiteLanguage) {
  const t = siteT(lang);
  const url = absoluteUrl(publicPath('contact', lang));
  return {
    '@context': 'https://schema.org',
    '@graph': [
      breadcrumbJsonLd(CONTACT_CRUMBS, t, lang),
      {
        // Sin correo ni teléfono: no están confirmados
        '@type': 'ContactPage',
        '@id': `${url}#webpage`,
        url,
        name: t('site.meta.contact.title'),
        description: t('site.meta.contact.description'),
        inLanguage: lang,
        breadcrumb: { '@id': `${url}#breadcrumb` },
        about: { '@type': 'Organization', name: 'GenSmart', url: `${SITE_ORIGIN}/` },
      },
    ],
  };
}

export default async function ContactPage({ params }: PageProps) {
  const lang = await resolveLang(params);
  const t = siteT(lang);
  const days = { days: SITE_TRIAL_DAYS };

  return (
    <SiteRoot>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd(lang)) }}
      />
      <SkipLink />
      <AnnounceBar />
      <SiteHeader />
      <main id="main">
        <ContactContent />
        <FinalCtaSection
          titleBefore={t('site.contact.cta.titleBefore')}
          titleAccent={t('site.contact.cta.titleAccent', days)}
          lead={t('site.contact.cta.lead')}
          primaryLabel={t('site.contact.cta.primary', days)}
          showDemo={false}
        />
      </main>
      <SiteFooter />
      <SiteChatWidget />
    </SiteRoot>
  );
}
