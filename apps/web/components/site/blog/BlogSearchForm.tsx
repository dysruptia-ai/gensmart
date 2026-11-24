'use client';

import { Search } from 'lucide-react';
import { useId, type ChangeEvent, type FormEvent } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTranslation } from '@/hooks/useTranslation';
import { publicPath, isSiteLanguage, DEFAULT_SITE_LANGUAGE } from '@/lib/site-routes';
import { useBlogFilter } from './BlogFilterContext';
import styles from './BlogSearchForm.module.css';

/**
 * Buscador del blog (design/web: `.bsb-search`): formulario GET a `/blog?q=`.
 * En el índice filtra "Todos los artículos" mientras se escribe.
 */
export default function BlogSearchForm() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const lang = isSiteLanguage(language) ? language : DEFAULT_SITE_LANGUAGE;
  const filter = useBlogFilter();
  const id = useId();

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    if (!filter) return;
    e.preventDefault();
    filter.reveal();
  };

  return (
    <form className={styles.form} role="search" action={publicPath('blog', lang)} method="get" onSubmit={onSubmit}>
      <label className={styles.srOnly} htmlFor={id}>
        {t('site.blog.sidebar.search')}
      </label>
      <Search size={18} aria-hidden="true" className={styles.icon} />
      <input
        id={id}
        className={styles.input}
        name="q"
        type="search"
        placeholder={t('site.blog.sidebar.search')}
        autoComplete="off"
        {...(filter
          ? {
              value: filter.query,
              onChange: (e: ChangeEvent<HTMLInputElement>) => {
                filter.setQuery(e.target.value);
                if (e.target.value.trim()) filter.reveal();
              },
            }
          : {})}
      />
      <button className={styles.srOnly} type="submit">
        {t('site.blog.sidebar.searchButton')}
      </button>
    </form>
  );
}
