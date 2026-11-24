import { postUrl, rssPath } from '@/components/site/blog/blogContent';
import { getAllPosts } from '@/lib/blog';
import { siteT } from '@/lib/site-i18n';
import { SITE_LANGUAGES, absoluteUrl, isSiteLanguage, publicPath } from '@/lib/site-routes';

/** RSS del blog: `/blog/rss.xml` (`proxy.ts` lo reescribe aquí) y `/en/blog/rss.xml`. */
export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams() {
  return SITE_LANGUAGES.map((lang) => ({ lang }));
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/** RFC 822 a mediodía UTC (las fechas del contenido son días, sin hora). */
const rfc822 = (iso: string) => new Date(`${iso}T12:00:00Z`).toUTCString();

export async function GET(_req: Request, { params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isSiteLanguage(lang)) return new Response(null, { status: 404 });
  const t = siteT(lang);
  const posts = getAllPosts(lang);
  const items = posts
    .map((p) => {
      const url = postUrl(p);
      return [
        '    <item>',
        `      <title>${esc(p.title)}</title>`,
        `      <link>${esc(url)}</link>`,
        `      <guid isPermaLink="true">${esc(url)}</guid>`,
        `      <description>${esc(p.description)}</description>`,
        `      <category>${esc(t(`site.blog.categories.${p.category}.name`))}</category>`,
        `      <pubDate>${rfc822(p.date)}</pubDate>`,
        '    </item>',
      ].join('\n');
    })
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(t('site.blog.rss.title'))}</title>
    <link>${esc(absoluteUrl(publicPath('blog', lang)))}</link>
    <description>${esc(t('site.blog.rss.description'))}</description>
    <language>${lang}</language>
    <atom:link href="${esc(absoluteUrl(rssPath(lang)))}" rel="self" type="application/rss+xml" />
    <lastBuildDate>${rfc822(posts.reduce((max, p) => (p.updated > max ? p.updated : max), '2026-01-01'))}</lastBuildDate>
${items}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
}
