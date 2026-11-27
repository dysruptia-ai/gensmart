'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { SavedView, SavedViewFilters } from './types';

export interface SavedViewsApi {
  views: SavedView[] | null;
  reload: () => void;
  create: (name: string, filters: SavedViewFilters) => Promise<SavedView>;
  update: (id: string, name: string, filters: SavedViewFilters) => Promise<SavedView>;
  remove: (id: string) => Promise<void>;
}

/** Vistas guardadas de quien mira (web-44). Son personales: nadie más las ve. */
export function useSavedViews(enabled: boolean): SavedViewsApi {
  const [views, setViews] = useState<SavedView[] | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    api
      .get<{ views: SavedView[] }>('/api/inbox-views')
      .then((data) => {
        if (!cancelled) setViews(data.views);
      })
      .catch(() => {
        if (!cancelled) setViews((v) => v ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  const create = useCallback(async (name: string, filters: SavedViewFilters) => {
    const { view } = await api.post<{ view: SavedView }>('/api/inbox-views', { name, filters });
    setViews((prev) => [...(prev ?? []), view]);
    return view;
  }, []);

  const update = useCallback(async (id: string, name: string, filters: SavedViewFilters) => {
    const { view } = await api.patch<{ view: SavedView }>(`/api/inbox-views/${id}`, { name, filters });
    setViews((prev) => (prev ?? []).map((v) => (v.id === id ? view : v)));
    return view;
  }, []);

  const remove = useCallback(async (id: string) => {
    await api.delete(`/api/inbox-views/${id}`);
    setViews((prev) => (prev ?? []).filter((v) => v.id !== id));
  }, []);

  return { views, reload, create, update, remove };
}
