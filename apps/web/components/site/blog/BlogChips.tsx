import SiteLink from '@/components/site/SiteLink';
import { blogCategoryRouteId, type BlogCategoryId } from '@/lib/blog-routes';
import { siteT } from '@/lib/site-i18n';
import type { SiteLanguage } from '@/lib/site-routes';
import { categoriesWithCount } from './blogContent';
import { getAllPosts } from '@/lib/blog';
import styles from './BlogChips.module.css';

interface BlogChipsProps {
  lang: SiteLanguage;
  /** Categoría actual (marcada con `aria-current`). Sin ella, "Todos". */
  active?: BlogCategoryId;
}

/** Chips de categorías con su contador, que enlazan a cada categoría (design/web: `chips`). */
export default function BlogChips({ lang, active }: BlogChipsProps) {
  const t = siteT(lang);
  return (
    <nav aria-label={t('site.blog.chipsLabel')}>
      <ul className={styles.chips}>
        <li>
          <SiteLink to="blog" className={styles.chip} aria-current={active ? undefined : 'page'}>
            {t('site.blog.all')} <em>{getAllPosts(lang).length}</em>
          </SiteLink>
        </li>
        {categoriesWithCount(lang).map((c) => (
          <li key={c.id}>
            <SiteLink
              to={blogCategoryRouteId(c.id)}
              className={styles.chip}
              aria-current={active === c.id ? 'page' : undefined}
            >
              {t(`site.blog.categories.${c.id}.name`)} <em>{c.count}</em>
            </SiteLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
