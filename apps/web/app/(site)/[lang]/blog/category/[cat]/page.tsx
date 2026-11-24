import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import BlogCategoryPage from '@/components/site/blog/BlogCategoryPage';
import { blogCategoryJsonLd, blogCategoryMetadata } from '@/components/site/blog/blogContent';
import SolutionShell from '@/components/site/solutions/SolutionShell';
import { BLOG_CATEGORY_ROUTES, type BlogCategoryId } from '@/lib/blog-routes';
import { siteT } from '@/lib/site-i18n';
import { SITE_LANGUAGES, isSiteLanguage, type SiteLanguage } from '@/lib/site-routes';

interface PageProps {
  params: Promise<{ lang: string; cat: string }>;
}

/** Slug desconocido: 404. La ruta interna usa el slug en inglés (`proxy.ts` reescribe el español). */
export const dynamicParams = false;

export function generateStaticParams() {
  return SITE_LANGUAGES.flatMap((lang) => BLOG_CATEGORY_ROUTES.map((c) => ({ lang, cat: c.slug.en })));
}

async function resolve(params: PageProps['params']): Promise<{ lang: SiteLanguage; category: BlogCategoryId }> {
  const { lang, cat } = await params;
  const route = BLOG_CATEGORY_ROUTES.find((c) => c.slug.en === cat);
  if (!isSiteLanguage(lang) || !route) notFound();
  return { lang, category: route.id };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang, category } = await resolve(params);
  return blogCategoryMetadata(category, lang, siteT(lang));
}

export const viewport: Viewport = {
  themeColor: '#0c1014',
};

/** Categoría del blog: `/blog/categoria/<slug-es>` y `/en/blog/category/<slug-en>`. */
export default async function BlogCategoryRoute({ params }: PageProps) {
  const { lang, category } = await resolve(params);
  return (
    <SolutionShell jsonLd={blogCategoryJsonLd(category, lang, siteT(lang))}>
      <BlogCategoryPage category={category} lang={lang} />
    </SolutionShell>
  );
}
