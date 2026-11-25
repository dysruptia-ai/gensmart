import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import LegalPage from '@/components/site/legal/LegalPage';
import { legalJsonLd, legalMetadata } from '@/components/site/legal/legalContent';
import SolutionShell from '@/components/site/solutions/SolutionShell';
import { getLegalDoc, legalIdByInternalSlug, type LegalDoc } from '@/lib/legal';
import { LEGAL_ROUTES } from '@/lib/legal-routes';
import { siteT } from '@/lib/site-i18n';
import { SITE_LANGUAGES, isSiteLanguage, type SiteLanguage } from '@/lib/site-routes';

interface PageProps {
  params: Promise<{ lang: string; slug: string }>;
}

/** Slug desconocido: 404. La ruta interna usa el slug en inglés (`proxy.ts` reescribe el español). */
export const dynamicParams = false;

export function generateStaticParams() {
  return SITE_LANGUAGES.flatMap((lang) => LEGAL_ROUTES.map((l) => ({ lang, slug: l.slug.en })));
}

async function resolve(params: PageProps['params']): Promise<{ lang: SiteLanguage; doc: LegalDoc }> {
  const { lang, slug } = await params;
  const id = legalIdByInternalSlug(slug);
  if (!isSiteLanguage(lang) || !id) notFound();
  return { lang, doc: getLegalDoc(id, lang) };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang, doc } = await resolve(params);
  return legalMetadata(doc, lang);
}

export const viewport: Viewport = {
  themeColor: '#0c1014',
};

/** Legal: `/legal/<slug-es>` y `/en/legal/<slug-en>`. */
export default async function LegalRoute({ params }: PageProps) {
  const { lang, doc } = await resolve(params);
  return (
    <SolutionShell jsonLd={legalJsonLd(doc, lang, siteT(lang))} cta={false}>
      <LegalPage doc={doc} lang={lang} />
    </SolutionShell>
  );
}
