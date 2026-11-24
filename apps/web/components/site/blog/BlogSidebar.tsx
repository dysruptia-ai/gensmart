import SiteButton from '@/components/site/SiteButton';
import SiteLink from '@/components/site/SiteLink';
import type { BlogHeading } from '@/lib/blog';
import { blogCategoryRouteId, type BlogCategoryId } from '@/lib/blog-routes';
import { blogPostHref } from '@/lib/site-links';
import { siteT } from '@/lib/site-i18n';
import type { SiteLanguage } from '@/lib/site-routes';
import { categoriesWithCount, formatPostDate, latestPosts } from './blogContent';
import BlogSearchForm from './BlogSearchForm';
import styles from './BlogSidebar.module.css';

interface BlogSidebarProps {
  lang: SiteLanguage;
  /** "En este artículo" (solo con 3 `h2` o más, como el diseño). */
  toc?: readonly BlogHeading[];
  /** Categoría actual en "Temas". */
  category?: BlogCategoryId;
  /** Artículo actual: no se repite en "Lo más reciente". */
  postId?: string;
}

/** Barra lateral del blog (design/web: `sidebar`). */
export default function BlogSidebar({ lang, toc, category, postId }: BlogSidebarProps) {
  const t = siteT(lang);
  return (
    <aside className={styles.sidebar} aria-label={t('site.blog.sidebar.label')}>
      {toc && toc.length >= 3 ? (
        <nav className={`${styles.box} ${styles.toc}`} aria-label={t('site.blog.post.tocLabel')}>
          <p className={styles.boxTitle}>{t('site.blog.post.inThisArticle')}</p>
          <ol>
            {toc.map((h) => (
              <li key={h.id}>
                <a href={`#${h.id}`}>{h.text}</a>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}

      <div className={`${styles.box} ${styles.search}`}>
        <BlogSearchForm />
      </div>

      <nav className={styles.box} aria-labelledby="bsb-topics">
        <h2 id="bsb-topics" className={styles.boxTitle}>
          {t('site.blog.sidebar.topics')}
        </h2>
        <ul className={styles.cats}>
          {categoriesWithCount(lang).map((c) => (
            <li key={c.id}>
              <SiteLink to={blogCategoryRouteId(c.id)} aria-current={category === c.id ? 'page' : undefined}>
                <span>{t(`site.blog.categories.${c.id}.name`)}</span>
                <em>{c.count}</em>
              </SiteLink>
            </li>
          ))}
        </ul>
      </nav>

      <section className={styles.box} aria-labelledby="bsb-latest">
        <h2 id="bsb-latest" className={styles.boxTitle}>
          {t('site.blog.sidebar.latest')}
        </h2>
        <ol className={styles.latest}>
          {latestPosts(lang, 4, postId).map((p) => (
            <li key={p.id}>
              <SiteLink href={blogPostHref(p.id, lang)}>
                <b>{p.title}</b>
                <small>
                  <time dateTime={p.date}>{formatPostDate(p.date, lang)}</time>
                </small>
              </SiteLink>
            </li>
          ))}
        </ol>
      </section>

      <div className={`${styles.box} ${styles.cta}`}>
        <p className={styles.bubble}>{t('site.blog.sidebar.trial')}</p>
        <SiteButton to="register">{t('site.blog.sidebar.trialCta')}</SiteButton>
      </div>
    </aside>
  );
}
