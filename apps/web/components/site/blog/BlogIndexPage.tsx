import PageHero from '@/components/site/PageHero';
import SiteButton from '@/components/site/SiteButton';
import { getAllPosts, getPostsByCategory } from '@/lib/blog';
import { blogCategoryRouteId } from '@/lib/blog-routes';
import { blogPostHref } from '@/lib/site-links';
import { siteT } from '@/lib/site-i18n';
import type { SiteLanguage } from '@/lib/site-routes';
import AllPosts, { type AllPostsItem } from './AllPosts';
import { normalizeSearch } from './normalizeSearch';
import BlogChips from './BlogChips';
import { BlogFilterProvider } from './BlogFilterContext';
import BlogLayout from './BlogLayout';
import BlogSidebar from './BlogSidebar';
import FeaturedPost from './FeaturedPost';
import NewsletterBand from './NewsletterBand';
import PathCard from './PathCard';
import PostCard from './PostCard';
import PostCover from './PostCover';
import {
  BLOG_INDEX_CRUMBS,
  BLOG_PATHS,
  PAGE_SIZE,
  categoriesWithCount,
  featuredPosts,
  guideOf,
} from './blogContent';
import styles from './BlogIndexPage.module.css';

interface BlogIndexPageProps {
  lang: SiteLanguage;
}

/** Índice del blog (design/web: `blog`). */
export default function BlogIndexPage({ lang }: BlogIndexPageProps) {
  const t = siteT(lang);
  const all = getAllPosts(lang);
  const main = guideOf('agentes', lang) ?? all[0];
  const news = getPostsByCategory('novedades', lang)[0];
  const pillars = categoriesWithCount(lang).filter((c) => c.id !== 'novedades');
  const items: AllPostsItem[] = all.map((p) => ({
    id: p.id,
    category: p.category,
    text: normalizeSearch(`${p.title} ${p.description}`),
    card: <PostCard post={p} lang={lang} />,
  }));

  return (
    <>
      <PageHero
        crumbs={BLOG_INDEX_CRUMBS}
        title={{ before: 'Blog' }}
        lead={t('site.blog.lead')}
        actions={<BlogChips lang={lang} />}
      />

      <BlogFilterProvider>
        <BlogLayout sidebar={<BlogSidebar lang={lang} />} id="todos">
          <div className={styles.hero}>
            {main ? <FeaturedPost post={main} lang={lang} /> : null}
            <section className={styles.dest} aria-labelledby="bl-dest">
              <h2 id="bl-dest" className={styles.label}>
                {t('site.blog.mostRead')}
              </h2>
              {featuredPosts(lang).map((p) => (
                <PostCard key={p.id} post={p} lang={lang} size="sm" />
              ))}
            </section>
          </div>

          <section className={styles.block} aria-labelledby="rutas-h">
            <div className={styles.head}>
              <div>
                <h2 id="rutas-h">{t('site.blog.paths.title')}</h2>
                <p>{t('site.blog.paths.lead')}</p>
              </div>
            </div>
            <div className={styles.paths}>
              {BLOG_PATHS.map((path) => (
                <PathCard key={path.id} path={path} lang={lang} />
              ))}
            </div>
          </section>

          {pillars.map((c) => {
            const posts = getPostsByCategory(c.id, lang);
            return (
              <section key={c.id} className={styles.block} id={`p-${c.id}`} aria-labelledby={`p-${c.id}-h`}>
                <div className={styles.head}>
                  <div>
                    <h2 id={`p-${c.id}-h`}>{t(`site.blog.categories.${c.id}.name`)}</h2>
                    <p>{t(`site.blog.categories.${c.id}.desc`)}</p>
                  </div>
                  <SiteButton to={blogCategoryRouteId(c.id)} variant="ghost" size="sm">
                    {t('site.blog.seeMore')} <small className={styles.count}>({posts.length})</small>
                  </SiteButton>
                </div>
                <div className={styles.grid}>
                  {posts.slice(0, 4).map((p) => (
                    <PostCard key={p.id} post={p} lang={lang} />
                  ))}
                </div>
              </section>
            );
          })}

          {news ? (
            <section className={styles.news} id="p-novedades" aria-labelledby="p-novedades-h">
              <div>
                <span className={styles.cat}>{t('site.blog.categories.novedades.name')}</span>
                <h2 id="p-novedades-h">{t('site.blog.news.title')}</h2>
                <p>{news.description}</p>
                <div className={styles.newsActions}>
                  <SiteButton href={blogPostHref(news.id, lang)}>{t('site.blog.news.read')}</SiteButton>
                  <SiteButton to={blogCategoryRouteId('novedades')} variant="ghost">
                    {t('site.blog.news.all')}
                  </SiteButton>
                </div>
              </div>
              <PostCover post={news} sizes="(max-width: 860px) 100vw, 360px" className={styles.newsCover} />
            </section>
          ) : null}

          <AllPosts
            items={items}
            categories={categoriesWithCount(lang).map((c) => ({
              id: c.id,
              label: t(`site.blog.categories.${c.id}.name`),
            }))}
            pageSize={PAGE_SIZE}
          />
        </BlogLayout>
      </BlogFilterProvider>

      <NewsletterBand />
    </>
  );
}
