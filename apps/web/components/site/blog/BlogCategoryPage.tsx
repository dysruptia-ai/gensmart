import PageHero from '@/components/site/PageHero';
import { getPostsByCategory } from '@/lib/blog';
import type { BlogCategoryId } from '@/lib/blog-routes';
import { siteT } from '@/lib/site-i18n';
import type { SiteLanguage } from '@/lib/site-routes';
import BlogChips from './BlogChips';
import BlogLayout from './BlogLayout';
import BlogSidebar from './BlogSidebar';
import FeaturedPost from './FeaturedPost';
import NewsletterBand from './NewsletterBand';
import PathCard from './PathCard';
import PostCard from './PostCard';
import { BLOG_PATHS, categoryCrumbs, guideOf } from './blogContent';
import styles from './BlogCategoryPage.module.css';

interface BlogCategoryPageProps {
  category: BlogCategoryId;
  lang: SiteLanguage;
}

/** Categoría del blog (design/web: `catPage`). */
export default function BlogCategoryPage({ category, lang }: BlogCategoryPageProps) {
  const t = siteT(lang);
  const name = t(`site.blog.categories.${category}.name`);
  const posts = getPostsByCategory(category, lang);
  const guide = guideOf(category, lang);
  const rest = guide ? posts.filter((p) => p.id !== guide.id) : posts;
  const paths = BLOG_PATHS.filter((p) => p.category === category);
  const subs = [...new Set(posts.map((p) => p.sub))];
  const groups =
    subs.length > 1
      ? subs.map((sub) => ({ sub, posts: rest.filter((p) => p.sub === sub) })).filter((g) => g.posts.length > 0)
      : [{ sub: null, posts: rest }];

  return (
    <>
      <PageHero
        crumbs={categoryCrumbs(category, t)}
        title={{ before: name }}
        lead={t(`site.blog.categories.${category}.desc`)}
        actions={<BlogChips lang={lang} active={category} />}
      />

      <BlogLayout sidebar={<BlogSidebar lang={lang} category={category} />}>
        {guide ? (
          <section aria-labelledby="bl-start">
            <h2 id="bl-start" className={styles.label}>
              {t('site.blog.category.startHere')}
            </h2>
            <FeaturedPost post={guide} lang={lang} />
          </section>
        ) : null}

        {paths.length ? (
          <div className={styles.paths}>
            {paths.map((path) => (
              <PathCard key={path.id} path={path} lang={lang} />
            ))}
          </div>
        ) : null}

        <section className={styles.list} aria-labelledby="bl-list">
          <h2 id="bl-list" className={styles.label}>
            {t('site.blog.category.articlesIn', { name })}
          </h2>
          {groups.map((g) => (
            <div key={g.sub ?? 'all'} className={g.sub ? styles.sub : undefined}>
              {g.sub ? <h3 className={styles.subTitle}>{t(`site.blog.subs.${g.sub}`)}</h3> : null}
              <div className={styles.grid}>
                {g.posts.map((p) => (
                  <PostCard key={p.id} post={p} lang={lang} headingLevel={g.sub ? 'h4' : 'h3'} />
                ))}
              </div>
            </div>
          ))}
        </section>
      </BlogLayout>

      <NewsletterBand />
    </>
  );
}
