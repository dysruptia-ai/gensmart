import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import BlogPostPage from '@/components/site/blog/BlogPostPage';
import { blogPostJsonLd, blogPostMetadata } from '@/components/site/blog/blogContent';
import SolutionShell from '@/components/site/solutions/SolutionShell';
import { getPostByInternalSlug, type BlogPost } from '@/lib/blog';
import { BLOG_POST_ROUTES } from '@/lib/blog-routes';
import { siteT } from '@/lib/site-i18n';
import { SITE_LANGUAGES, isSiteLanguage, type SiteLanguage } from '@/lib/site-routes';

interface PageProps {
  params: Promise<{ lang: string; post: string }>;
}

/** Slug desconocido: 404. La ruta interna usa el slug en inglés (`proxy.ts` reescribe el español). */
export const dynamicParams = false;

export function generateStaticParams() {
  return SITE_LANGUAGES.flatMap((lang) => BLOG_POST_ROUTES.map((p) => ({ lang, post: p.slug.en })));
}

async function resolve(params: PageProps['params']): Promise<{ lang: SiteLanguage; post: BlogPost }> {
  const { lang, post: slug } = await params;
  if (!isSiteLanguage(lang)) notFound();
  const post = getPostByInternalSlug(slug, lang);
  if (!post) notFound();
  return { lang, post };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang, post } = await resolve(params);
  return blogPostMetadata(post, lang, siteT(lang));
}

export const viewport: Viewport = {
  themeColor: '#0c1014',
};

/** Artículo del blog: `/blog/<slug-es>` y `/en/blog/<slug-en>`. */
export default async function BlogPostRoute({ params }: PageProps) {
  const { lang, post } = await resolve(params);
  return (
    <SolutionShell jsonLd={blogPostJsonLd(post, lang, siteT(lang))}>
      <BlogPostPage post={post} lang={lang} />
    </SolutionShell>
  );
}
