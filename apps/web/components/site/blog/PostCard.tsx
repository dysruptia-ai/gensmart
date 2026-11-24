import SiteLink from '@/components/site/SiteLink';
import type { BlogPostMeta } from '@/lib/blog';
import { blogPostHref } from '@/lib/site-links';
import { siteT } from '@/lib/site-i18n';
import type { SiteLanguage } from '@/lib/site-routes';
import { formatPostDate } from './blogContent';
import PostCover from './PostCover';
import styles from './PostCard.module.css';

interface PostCardProps {
  post: BlogPostMeta;
  lang: SiteLanguage;
  /** `sm`: lista compacta ("Lo más leído para empezar"). */
  size?: 'default' | 'sm';
  /** Nivel del título según la sección donde va. */
  headingLevel?: 'h3' | 'h4';
}

/** Tarjeta de artículo (design/web: `postCard`). */
export default function PostCard({ post, lang, size = 'default', headingLevel = 'h3' }: PostCardProps) {
  const t = siteT(lang);
  const Heading = headingLevel;
  const category = t(`site.blog.categories.${post.category}.name`);
  if (size === 'sm') {
    return (
      <SiteLink href={blogPostHref(post.id, lang)} className={`${styles.card} ${styles.sm}`}>
        <PostCover post={post} sizes="120px" className={styles.cover} />
        <div>
          <span className={styles.cat}>{category}</span>
          <Heading className={styles.title}>{post.title}</Heading>
        </div>
      </SiteLink>
    );
  }
  return (
    <SiteLink href={blogPostHref(post.id, lang)} className={styles.card}>
      <PostCover post={post} sizes="(max-width: 760px) 100vw, (max-width: 1060px) 50vw, 380px" className={styles.cover} />
      <div className={styles.body}>
        <span className={styles.cat}>{category}</span>
        <Heading className={styles.title}>{post.title}</Heading>
        <p className={styles.excerpt}>{post.description}</p>
        <small className={styles.meta}>
          <time dateTime={post.date}>{formatPostDate(post.date, lang)}</time> · {t('site.blog.min', { n: post.read })}
        </small>
      </div>
    </SiteLink>
  );
}
