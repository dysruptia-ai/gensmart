'use client';

import { Search } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useSiteTranslation } from '@/hooks/useSiteTranslation';
import { fold } from '../docs/searchMatch';
import styles from './AcademyIndexPage.module.css';

/**
 * Catálogo de Academy (design/web: `academia()` y su script): búsqueda, filtros por grupo
 * y contador. Las tarjetas salen completas en el HTML del servidor; el filtro solo las oculta.
 * El buscador del hero, las entradas por audiencia y "Explora por producto" comparten este estado.
 */
export type FilterGroupId = 'type' | 'products' | 'level' | 'aud';

export interface CatalogItem {
  id: string;
  type: string;
  level: string;
  products: readonly string[];
  /** Vacío = para todos. */
  audience: readonly string[];
  /** Título, objetivo y productos, para la búsqueda. */
  text: string;
}

export interface FilterGroup {
  id: FilterGroupId;
  label: string;
  options: readonly { id: string; name: string }[];
}

type Filters = Record<FilterGroupId, string>;

const NO_FILTERS: Filters = { type: '', products: '', level: '', aud: '' };

interface CatalogState {
  query: string;
  setQuery: (q: string) => void;
  filters: Filters;
  setFilter: (group: FilterGroupId, value: string) => void;
  /** Deja solo ese filtro (entradas del hero y productos). */
  focusFilter: (group: FilterGroupId, value: string) => void;
  clear: () => void;
  active: boolean;
  visible: ReadonlySet<string>;
}

const CatalogContext = createContext<CatalogState | null>(null);

function useCatalog(): CatalogState {
  const value = useContext(CatalogContext);
  if (!value) throw new Error('AcademyCatalog: falta AcademyCatalogProvider');
  return value;
}

function matches(item: CatalogItem, filters: Filters, words: readonly string[]): boolean {
  if (filters.type && item.type !== filters.type) return false;
  if (filters.level && item.level !== filters.level) return false;
  if (filters.products && !item.products.includes(filters.products)) return false;
  if (filters.aud && item.audience.length > 0 && !item.audience.includes(filters.aud)) return false;
  const text = fold(item.text);
  return words.every((w) => text.includes(w));
}

export function AcademyCatalogProvider({ items, children }: { items: readonly CatalogItem[]; children: ReactNode }) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);

  const setFilter = useCallback((group: FilterGroupId, value: string) => {
    setFilters((f) => ({ ...f, [group]: value }));
  }, []);
  const focusFilter = useCallback((group: FilterGroupId, value: string) => {
    setQuery('');
    setFilters({ ...NO_FILTERS, [group]: value });
  }, []);
  const clear = useCallback(() => {
    setQuery('');
    setFilters(NO_FILTERS);
  }, []);

  const value = useMemo<CatalogState>(() => {
    const words = fold(query).split(/\s+/).filter(Boolean);
    const visible = new Set(items.filter((item) => matches(item, filters, words)).map((item) => item.id));
    const active = words.length > 0 || Object.values(filters).some(Boolean);
    return { query, setQuery, filters, setFilter, focusFilter, clear, active, visible };
  }, [items, query, filters, setFilter, focusFilter, clear]);

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

/** Buscador del hero: no recarga la página; al enviarlo baja al catálogo. */
export function CatalogSearch({ targetId }: { targetId: string }) {
  const { t } = useSiteTranslation();
  const { query, setQuery } = useCatalog();
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    document.getElementById(targetId)?.scrollIntoView({ block: 'start' });
  };
  return (
    <form className={styles.search} role="search" onSubmit={onSubmit}>
      <label className={styles.srOnly} htmlFor="ac-q">
        {t('site.academy.hero.searchLabel')}
      </label>
      <input
        id="ac-q"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('site.academy.hero.searchPlaceholder')}
        autoComplete="off"
      />
      <span aria-hidden="true">
        <Search size={20} />
      </span>
    </form>
  );
}

/** Enlace a `#ac-cat` que deja aplicado un filtro (audiencias del hero y productos). */
export function FilterLink({
  group,
  value,
  targetId,
  className,
  children,
}: {
  group: FilterGroupId;
  value: string;
  targetId: string;
  className?: string;
  children: ReactNode;
}) {
  const { focusFilter } = useCatalog();
  return (
    <a className={className} href={`#${targetId}`} onClick={() => focusFilter(group, value)}>
      {children}
    </a>
  );
}

export function CatalogFilters({ groups }: { groups: readonly FilterGroup[] }) {
  const { t } = useSiteTranslation();
  const { filters, setFilter } = useCatalog();
  return (
    <div className={styles.filters}>
      {groups.map((g) => (
        <div key={g.id} className={styles.filterGroup} role="group" aria-labelledby={`ac-fl-${g.id}`}>
          <span className={styles.filterLabel} id={`ac-fl-${g.id}`}>
            {g.label}
          </span>
          <div className={styles.chips}>
            {[{ id: '', name: t('site.academy.catalog.all') }, ...g.options].map((o) => {
              const on = filters[g.id] === o.id;
              return (
                <button
                  key={o.id || 'all'}
                  type="button"
                  className={on ? `${styles.chip} ${styles.chipOn}` : styles.chip}
                  aria-pressed={on}
                  onClick={() => setFilter(g.id, o.id)}
                >
                  {o.name}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function CatalogCount() {
  const { t } = useSiteTranslation();
  const { visible, active, clear } = useCatalog();
  const n = visible.size;
  return (
    <div className={styles.countRow}>
      <p className={styles.count} aria-live="polite">
        <b>{n}</b> {t(n === 1 ? 'site.academy.catalog.courseOne' : 'site.academy.catalog.courseOther')}
      </p>
      <button type="button" className={styles.clear} hidden={!active} onClick={clear}>
        {t('site.academy.catalog.clear')}
      </button>
    </div>
  );
}

/** Rejilla de tarjetas: todas en el HTML; el filtro solo oculta (`hidden`). */
export function CatalogGrid({ cards }: { cards: readonly { id: string; node: ReactNode }[] }) {
  const { t } = useSiteTranslation();
  const { visible } = useCatalog();
  return (
    <>
      <ul className={styles.grid}>
        {cards.map((c) => (
          <li key={c.id} hidden={!visible.has(c.id)}>
            {c.node}
          </li>
        ))}
      </ul>
      <p className={styles.empty} hidden={visible.size > 0}>
        {t('site.academy.catalog.empty')}
      </p>
    </>
  );
}
