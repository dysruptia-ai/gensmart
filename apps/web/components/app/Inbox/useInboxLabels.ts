'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { InboxLabel } from './types';

/** Lo emite Ajustes de la bandeja (además del `inbox-labels:changed` del servidor). */
export const INBOX_LABELS_CHANGED = 'gs:inbox-labels-changed';

export function notifyInboxLabelsChanged(): void {
  window.dispatchEvent(new Event(INBOX_LABELS_CHANGED));
}

/** Catálogo de etiquetas de la organización (web-43), en orden alfabético. */
export function useInboxLabels() {
  const [labels, setLabels] = useState<InboxLabel[] | null>(null);
  const [error, setError] = useState(false);

  const reload = useCallback(() => {
    api
      .get<{ labels: InboxLabel[] }>('/api/inbox-labels')
      .then((data) => {
        setLabels(data.labels);
        setError(false);
      })
      .catch(() => setError(true));
  }, []);

  useEffect(() => {
    reload();
    window.addEventListener(INBOX_LABELS_CHANGED, reload);
    return () => window.removeEventListener(INBOX_LABELS_CHANGED, reload);
  }, [reload]);

  /** Crea una etiqueta (solo owner/admin). Devuelve la nueva o el código del error. */
  const create = useCallback(async (name: string): Promise<{ label: InboxLabel } | { error: string }> => {
    try {
      const r = await api.post<{ label: InboxLabel }>('/api/inbox-labels', { name });
      setLabels((prev) =>
        [...(prev ?? []), r.label].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
      );
      return { label: r.label };
    } catch (err) {
      const code = (err as { code?: string }).code;
      return { error: code ?? 'failed' };
    }
  }, []);

  return { labels, error, reload, create, setLabels };
}
