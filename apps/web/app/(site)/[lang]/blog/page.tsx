import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import BlogIndexPage from '@/components/site/blog/BlogIndexPage';
import { blogIndexJsonLd, blogIndexMetadata } from '@/components/site/blog/blogContent';
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
  return blogIndexMetadata(lang, siteT(lang));
}

export const viewport: Viewport = {
  themeColor: '#0c1014',
};

/** Índice del blog: `/blog` y `/en/blog` (`?q=` filtra en el navegador; el canonical va sin query). */
export default async function BlogRoute({ params }: PageProps) {
  const lang = await resolveLang(params);
  return (
    <SolutionShell jsonLd={blogIndexJsonLd(lang, siteT(lang))}>
      <BlogIndexPage lang={lang} />
    </SolutionShell>
  );
}
