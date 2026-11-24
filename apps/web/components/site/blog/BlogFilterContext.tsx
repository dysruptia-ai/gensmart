'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/** Id de "Todos los artículos": la búsqueda lleva la vista hasta ahí. */
export const ALL_POSTS_HEADING_ID = 'todos-h';

interface BlogFilterValue {
  query: string;
  setQuery: (q: string) => void;
  /** Lleva la vista a "Todos los artículos". */
  reveal: () => void;
}

const BlogFilterContext = createContext<BlogFilterValue | null>(null);

/** Búsqueda en vivo del índice (null fuera del índice: el buscador envía el formulario). */
export function useBlogFilter(): BlogFilterValue | null {
  return useContext(BlogFilterContext);
}

function reveal(smooth = true) {
  const target = document.getElementById(ALL_POSTS_HEADING_ID);
  if (!target) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  target.scrollIntoView({ behavior: smooth && !reduce ? 'smooth' : 'auto', block: 'start' });
}

/**
 * Une el buscador de la barra lateral con "Todos los artículos" en el índice del blog.
 * Lee `?q=` al cargar (llega desde el buscador de otras páginas del blog).
 */
export function BlogFilterProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('q')?.trim();
    if (!q) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- la URL solo existe en el cliente
    setQuery(q);
    window.setTimeout(() => reveal(false), 50);
  }, []);

  const value = useMemo(() => ({ query, setQuery, reveal: () => reveal() }), [query]);
  return <BlogFilterContext.Provider value={value}>{children}</BlogFilterContext.Provider>;
}
