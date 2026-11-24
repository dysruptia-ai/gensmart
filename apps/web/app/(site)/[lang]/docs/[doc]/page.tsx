import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import DocGuidePage from '@/components/site/docs/DocGuidePage';
import DocsShell from '@/components/site/docs/DocsShell';
import { docByInternalSlug, docJsonLd, docMetadata } from '@/components/site/docs/docsContent';
import type { DocData } from '@/components/site/docs/docsData';
import SolutionShell from '@/components/site/solutions/SolutionShell';
import { DOC_ROUTES } from '@/lib/docs-routes';
import { siteT } from '@/lib/site-i18n';
import { SITE_LANGUAGES, isSiteLanguage, type SiteLanguage } from '@/lib/site-routes';

interface PageProps {
  params: Promise<{ lang: string; doc: string }>;
}

/** Slug desconocido: 404. La ruta interna usa el slug en inglés (`proxy.ts` reescribe el español). */
export const dynamicParams = false;

export function generateStaticParams() {
  return SITE_LANGUAGES.flatMap((lang) => DOC_ROUTES.map((d) => ({ lang, doc: d.slug.en })));
}

async function resolve(params: PageProps['params']): Promise<{ lang: SiteLanguage; doc: DocData }> {
  const { lang, doc: slug } = await params;
  const doc = docByInternalSlug(slug);
  if (!isSiteLanguage(lang) || !doc) notFound();
  return { lang, doc };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang, doc } = await resolve(params);
  return docMetadata(doc, lang, siteT(lang));
}

export const viewport: Viewport = {
  themeColor: '#0c1014',
};

/** Guía de la base de conocimiento: `/docs/<slug-es>` y `/en/docs/<slug-en>`. */
export default async function DocRoute({ params }: PageProps) {
  const { lang, doc } = await resolve(params);
  return (
    <SolutionShell jsonLd={docJsonLd(doc, lang, siteT(lang))} cta={false}>
      <DocsShell>
        <DocGuidePage doc={doc} lang={lang} />
      </DocsShell>
    </SolutionShell>
  );
}
