'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { QuickReply } from './quickReplies';

/** Lo emite Ajustes de la bandeja al crear, editar o borrar: las listas abiertas se recargan. */
export const QUICK_REPLIES_CHANGED = 'gs:quick-replies-changed';

export function notifyQuickRepliesChanged(): void {
  window.dispatchEvent(new Event(QUICK_REPLIES_CHANGED));
}

/**
 * Respuestas rápidas de la organización (web-43). Se cargan una vez al montar el panel y se recargan
 * al volver a la pestaña del navegador o cuando cambian en Ajustes.
 */
export function useQuickReplies() {
  const [replies, setReplies] = useState<QuickReply[] | null>(null);
  const [error, setError] = useState(false);

  const reload = useCallback(() => {
    api
      .get<{ quickReplies: QuickReply[] }>('/api/quick-replies')
      .then((data) => {
        setReplies(data.quickReplies);
        setError(false);
      })
      .catch(() => setError(true));
  }, []);

  useEffect(() => {
    reload();
    const onVisible = () => {
      if (document.visibilityState === 'visible') reload();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener(QUICK_REPLIES_CHANGED, reload);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener(QUICK_REPLIES_CHANGED, reload);
    };
  }, [reload]);

  /** Suma un uso (al insertar, no al enviar). Si falla no se muestra nada. */
  const markUsed = useCallback((id: string) => {
    setReplies((prev) => prev?.map((r) => (r.id === id ? { ...r, useCount: r.useCount + 1 } : r)) ?? prev);
    api.post(`/api/quick-replies/${id}/use`).catch(() => undefined);
  }, []);

  return { replies, error, reload, markUsed, setReplies };
}
