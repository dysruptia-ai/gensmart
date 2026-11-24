import { ArrowRight } from 'lucide-react';
import SiteLink from '@/components/site/SiteLink';
import { blogPostHref } from '@/lib/site-links';
import { siteT } from '@/lib/site-i18n';
import type { SiteLanguage } from '@/lib/site-routes';
import { BLOG_PATHS, pathPosts, type BlogPath } from './blogContent';
import styles from './PathCard.module.css';

interface PathCardProps {
  path: BlogPath;
  lang: SiteLanguage;
}

/** Tarjeta de una ruta de lectura (design/web: `rutaCard`): va al primer artículo. */
export default function PathCard({ path, lang }: PathCardProps) {
  const t = siteT(lang);
  const posts = pathPosts(path, lang);
  const first = posts[0];
  if (!first) return null;
  const minutes = posts.reduce((n, p) => n + p.read, 0);
  return (
    <SiteLink href={blogPostHref(first.id, lang)} className={styles.card}>
      <span className={styles.n} aria-hidden="true">
        {String(BLOG_PATHS.indexOf(path) + 1).padStart(2, '0')}
      </span>
      <h3 className={styles.title}>{t(`site.blog.paths.items.${path.id}.name`)}</h3>
      <p className={styles.desc}>{t(`site.blog.paths.items.${path.id}.desc`)}</p>
      <small className={styles.meta}>{t('site.blog.paths.reads', { n: posts.length, m: minutes })}</small>
      <span className={styles.go}>
        {t('site.blog.paths.start')} <ArrowRight size={16} aria-hidden="true" />
      </span>
    </SiteLink>
  );
}
