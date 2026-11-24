import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import DocsIndexPage from '@/components/site/docs/DocsIndexPage';
import DocsShell from '@/components/site/docs/DocsShell';
import { docsIndexJsonLd, docsIndexMetadata } from '@/components/site/docs/docsContent';
import SolutionShell from '@/components/site/solutions/SolutionShell';
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
  const lang = await resolveLang(params);
  return docsIndexMetadata(lang, siteT(lang));
}

export const viewport: Viewport = {
  themeColor: '#0c1014',
};

/** Base de conocimiento, "Centro de ayuda": `/docs` y `/en/docs`. */
export default async function DocsRoute({ params }: PageProps) {
  const lang = await resolveLang(params);
  return (
    <SolutionShell jsonLd={docsIndexJsonLd(lang, siteT(lang))} cta={false}>
      <DocsShell>
        <DocsIndexPage lang={lang} />
      </DocsShell>
    </SolutionShell>
  );
}
