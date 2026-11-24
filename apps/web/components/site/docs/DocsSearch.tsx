'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { highlight, searchDocs, type SearchEntry } from './searchMatch';
import styles from './DocsSearch.module.css';

interface SearchContextValue {
  open: (trigger: HTMLElement | null) => void;
}

const SearchContext = createContext<SearchContextValue | null>(null);

/** Índice por idioma: se pide la primera vez que se abre el diálogo y queda en memoria. */
const indexCache = new Map<string, Promise<SearchEntry[]>>();

function loadIndex(lang: string): Promise<SearchEntry[]> {
  let pending = indexCache.get(lang);
  if (!pending) {
    pending = fetch(`/docs-search-index/${lang}`)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json() as Promise<SearchEntry[]>;
      })
      .catch((err: unknown) => {
        indexCache.delete(lang);
        throw err;
      });
    indexCache.set(lang, pending);
  }
  return pending;
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

interface DocsSearchProps {
  children: ReactNode;
}

/** Buscador de la base de conocimiento (design/web: `dxSearchDialog`): proveedor, atajos y diálogo. */
export default function DocsSearch({ children }: DocsSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);

  const open = useCallback((trigger: HTMLElement | null) => {
    triggerRef.current = trigger;
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    // Devuelve el foco a quien abrió el diálogo (botón o lo que tenía el foco al usar el atajo)
    const trigger = triggerRef.current;
    requestAnimationFrame(() => trigger?.focus());
  }, []);

  // Atajos: "/" (fuera de un campo de texto) y Ctrl/Cmd+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isOpen) return;
      const mod = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k';
      const slash = e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !isTyping(e.target);
      if (!mod && !slash) return;
      e.preventDefault();
      open(document.activeElement instanceof HTMLElement ? document.activeElement : null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, open]);

  const value = useMemo(() => ({ open }), [open]);

  return (
    <SearchContext.Provider value={value}>
      {children}
      {isOpen ? <SearchDialog onClose={close} /> : null}
    </SearchContext.Provider>
  );
}

interface DocsSearchButtonProps {
  variant: 'side' | 'hero';
}

/** Botón que abre el buscador: el de la barra lateral y el grande del índice. */
export function DocsSearchButton({ variant }: DocsSearchButtonProps) {
  const { t } = useTranslation();
  const ctx = useContext(SearchContext);
  const hero = variant === 'hero';
  return (
    <button
      type="button"
      className={hero ? styles.heroButton : styles.sideButton}
      aria-haspopup="dialog"
      aria-keyshortcuts="Control+K Meta+K /"
      onClick={(e) => ctx?.open(e.currentTarget)}
    >
      <Search size={hero ? 20 : 16} aria-hidden="true" />
      <span>{hero ? t('site.docs.search.placeholder') : t('site.docs.search.short')}</span>
      <kbd aria-hidden="true">Ctrl K</kbd>
    </button>
  );
}

type IndexState = { status: 'loading' } | { status: 'ready'; entries: SearchEntry[] } | { status: 'error' };

function SearchDialog({ onClose }: { onClose: () => void }) {
  const { t, language } = useTranslation();
  const router = useRouter();
  const [index, setIndex] = useState<IndexState>({ status: 'loading' });
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const uid = useId();
  const listId = `${uid}-list`;
  const titleId = `${uid}-title`;

  useEffect(() => {
    let alive = true;
    loadIndex(language)
      .then((entries) => alive && setIndex({ status: 'ready', entries }))
      .catch(() => alive && setIndex({ status: 'error' }));
    return () => {
      alive = false;
    };
  }, [language]);

  // Foco al campo y sin scroll de fondo mientras está abierto
  useEffect(() => {
    inputRef.current?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  const results = useMemo(
    () => (index.status === 'ready' ? searchDocs(index.entries, query) : []),
    [index, query]
  );
  const current = Math.min(active, Math.max(results.length - 1, 0));
  const optionId = (i: number) => `${uid}-opt-${i}`;

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${current}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [current]);

  const go = (entry: SearchEntry | undefined) => {
    if (!entry) return;
    onClose();
    router.push(entry.href);
  };

  const onInputKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(results.length ? (current + 1) % results.length : 0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(results.length ? (current - 1 + results.length) % results.length : 0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(results[current]);
    }
  };

  // Esc cierra; Tab no sale del diálogo
  const onBoxKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !boxRef.current) return;
    const focusables = Array.from(
      boxRef.current.querySelectorAll<HTMLElement>('input, button, [href], [tabindex]:not([tabindex="-1"])')
    );
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (!first || !last) return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const status =
    index.status === 'loading'
      ? t('site.docs.search.loading')
      : index.status === 'error'
        ? t('site.docs.search.error')
        : results.length === 1
          ? t('site.docs.search.result')
          : t('site.docs.search.results', { count: results.length });

  const expanded = index.status === 'ready' && results.length > 0;

  return (
    <div className={styles.overlay}>
      <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />
      <div
        ref={boxRef}
        className={styles.box}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onBoxKey}
      >
        <h2 id={titleId} className={styles.srOnly}>
          {t('site.docs.search.open')}
        </h2>
        <div className={styles.top}>
          <Search size={18} aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            className={styles.input}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onInputKey}
            placeholder={t('site.docs.search.placeholder')}
            aria-label={t('site.docs.search.label')}
            role="combobox"
            aria-expanded={expanded}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={expanded ? optionId(current) : undefined}
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="go"
          />
          <button type="button" className={styles.close} onClick={onClose} aria-label={t('site.docs.search.close')}>
            Esc
          </button>
        </div>

        <ul ref={listRef} id={listId} role="listbox" className={styles.list} aria-label={t('site.docs.search.label')}>
          {results.map((entry, i) => (
            <li
              key={entry.href}
              id={optionId(i)}
              role="option"
              aria-selected={i === current}
              data-index={i}
              className={styles.option}
              onMouseMove={() => i !== current && setActive(i)}
              onClick={() => go(entry)}
            >
              <span className={styles.group}>{entry.group}</span>
              <span className={styles.title}>
                {highlight(entry.title, query).map((part, pi) =>
                  part.hit ? <mark key={pi}>{part.text}</mark> : part.text
                )}
              </span>
              <span className={styles.summary}>{entry.summary}</span>
            </li>
          ))}
        </ul>

        {index.status === 'ready' && results.length === 0 ? <p className={styles.empty}>{t('site.docs.search.empty')}</p> : null}
        {index.status !== 'ready' ? <p className={styles.empty}>{status}</p> : null}
        <p className={styles.srOnly} role="status" aria-live="polite">
          {index.status === 'ready' ? status : ''}
        </p>

        <div className={styles.foot} aria-hidden="true">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> {t('site.docs.search.keyMove')}
          </span>
          <span>
            <kbd>↵</kbd> {t('site.docs.search.keyOpen')}
          </span>
          <span>
            <kbd>Esc</kbd> {t('site.docs.search.keyClose')}
          </span>
        </div>
      </div>
    </div>
  );
}
