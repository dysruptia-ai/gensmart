'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import type { BlogCategoryId } from '@/lib/blog-routes';
import { ALL_POSTS_HEADING_ID, useBlogFilter } from './BlogFilterContext';
import { normalizeSearch } from './normalizeSearch';
import styles from './AllPosts.module.css';

export interface AllPostsItem {
  id: string;
  category: BlogCategoryId;
  /** Título y resumen, normalizados (sin tildes ni mayúsculas). */
  text: string;
  /** Tarjeta ya renderizada en el servidor. */
  card: ReactNode;
}

interface AllPostsProps {
  items: readonly AllPostsItem[];
  categories: ReadonlyArray<{ id: BlogCategoryId; label: string }>;
  pageSize: number;
}

/**
 * "Todos los artículos" (design/web: `.bl-all`): chips de filtro, búsqueda del buscador
 * lateral y "Ver más" de 12 en 12. Todas las tarjetas están en el HTML del servidor:
 * el filtro y el "Ver más" solo las ocultan.
 */
export default function AllPosts({ items, categories, pageSize }: AllPostsProps) {
  const { t } = useSiteTranslation();
  const filter = useBlogFilter();
  const [category, setCategory] = useState<BlogCategoryId | 'all'>('all');
  const [limit, setLimit] = useState(pageSize);
  const query = normalizeSearch(filter?.query ?? '');
  const [lastQuery, setLastQuery] = useState(query);
  // Una búsqueda nueva vuelve a la primera tanda (como el diseño)
  if (query !== lastQuery) {
    setLastQuery(query);
    setLimit(pageSize);
  }

  const matches = useMemo(
    () =>
      items.filter((it) => (category === 'all' || it.category === category) && (!query || it.text.includes(query))),
    [items, category, query]
  );
  const visible = new Set(matches.slice(0, limit).map((it) => it.id));

  const choose = (id: BlogCategoryId | 'all') => {
    setCategory(id);
    setLimit(pageSize);
  };

  return (
    <section className={styles.all} aria-labelledby={ALL_POSTS_HEADING_ID}>
      <div className={styles.head}>
        <h2 id={ALL_POSTS_HEADING_ID}>{t('site.blog.allTitle')}</h2>
      </div>
      <div className={styles.chips} role="group" aria-label={t('site.blog.filterLabel')}>
        <button type="button" aria-pressed={category === 'all'} onClick={() => choose('all')}>
          {t('site.blog.all')}
        </button>
        {categories.map((c) => (
          <button key={c.id} type="button" aria-pressed={category === c.id} onClick={() => choose(c.id)}>
            {c.label}
          </button>
        ))}
      </div>
      <p className={styles.count} aria-live="polite">
        {t('site.blog.count', { shown: Math.min(limit, matches.length), total: matches.length })}
      </p>
      <div className={styles.grid}>
        {items.map((it) => (
          <div key={it.id} className={styles.item} hidden={!visible.has(it.id)}>
            {it.card}
          </div>
        ))}
      </div>
      {matches.length === 0 ? <p className={styles.empty}>{t('site.blog.empty')}</p> : null}
      {matches.length > limit ? (
        <p className={styles.more}>
          <button type="button" className={styles.moreButton} onClick={() => setLimit((n) => n + pageSize)}>
            {t('site.blog.loadMore')}
          </button>
        </p>
      ) : null}
    </section>
  );
}
