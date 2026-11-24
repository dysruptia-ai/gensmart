import SiteLink from '@/components/site/SiteLink';
import type { BlogPost } from '@/lib/blog';
import { blogPostHref } from '@/lib/site-links';
import { siteT } from '@/lib/site-i18n';
import type { SiteLanguage } from '@/lib/site-routes';
import { pathOf, pathPosts } from './blogContent';
import styles from './PathBox.module.css';

interface PathBoxProps {
  post: BlogPost;
  lang: SiteLanguage;
}

/** "Paso X de N" con anterior y siguiente, si el artículo es de una ruta (design/web: `ruta-box`). */
export default function PathBox({ post, lang }: PathBoxProps) {
  const path = pathOf(post);
  if (!path) return null;
  const t = siteT(lang);
  const posts = pathPosts(path, lang);
  const i = posts.findIndex((p) => p.id === post.id);
  const prev = posts[i - 1];
  const next = posts[i + 1];
  return (
    <nav className={styles.box} aria-label={t('site.blog.post.pathLabel')}>
      <div className={styles.head}>
        <span>{t('site.blog.post.pathTag')}</span>
        <b>{t(`site.blog.paths.items.${path.id}.name`)}</b>
        <em>{t('site.blog.post.pathStep', { i: i + 1, n: posts.length })}</em>
      </div>
      <div className={styles.nav}>
        {prev ? (
          <SiteLink href={blogPostHref(prev.id, lang)} rel="prev">
            <small>{t('site.blog.post.prev')}</small>
            {prev.title}
          </SiteLink>
        ) : (
          <span />
        )}
        {next ? (
          <SiteLink href={blogPostHref(next.id, lang)} rel="next" className={styles.next}>
            <small>{t('site.blog.post.next')}</small>
            {next.title}
          </SiteLink>
        ) : (
          <span />
        )}
      </div>
    </nav>
  );
}
