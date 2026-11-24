import SiteLink from '@/components/site/SiteLink';
import type { BlogPostMeta } from '@/lib/blog';
import { blogPostHref } from '@/lib/site-links';
import { siteT } from '@/lib/site-i18n';
import type { SiteLanguage } from '@/lib/site-routes';
import PostCover from './PostCover';
import styles from './FeaturedPost.module.css';

interface FeaturedPostProps {
  post: BlogPostMeta;
  lang: SiteLanguage;
}

/** Artículo destacado con portada grande (design/web: `featTop`). */
export default function FeaturedPost({ post, lang }: FeaturedPostProps) {
  const t = siteT(lang);
  return (
    <SiteLink href={blogPostHref(post.id, lang)} className={styles.feat}>
      <PostCover post={post} sizes="(max-width: 860px) 100vw, 440px" className={styles.cover} />
      <div className={styles.body}>
        <span className={styles.cat}>{t(`site.blog.categories.${post.category}.name`)}</span>
        <h2 className={styles.title}>{post.title}</h2>
        <p className={styles.bubble}>{post.description}</p>
        <small className={styles.meta}>
          {t('site.blog.mainGuide')} · {t('site.blog.minRead', { n: post.read })}
        </small>
      </div>
    </SiteLink>
  );
}
