'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

export type SuggestionsState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; items: string[] }
  | { kind: 'limit' };

interface SuggestionsResponse {
  suggestions: string[];
  reason?: string;
}

/** Con un mensaje nuevo del cliente se espera esto antes de pedir (varios seguidos = una petición). */
const NEW_MESSAGE_DELAY_MS = 1500;

const IDLE: SuggestionsState = { kind: 'idle' };

/**
 * Respuestas sugeridas (web-46) para el último mensaje del cliente (`anchorId`). Se piden solas cuando
 * `enabled` (la conversación es tuya, el último mensaje es del cliente, la IA está disponible y la
 * ventana abierta) y la pestaña del navegador está visible. Son de quien las pide: no llegan al equipo.
 * El resultado va con su clave (conversación + mensaje): con otro mensaje, la fila se oculta sola.
 */
export function useSuggestions(conversationId: string, anchorId: string | null, enabled: boolean): SuggestionsState {
  const [result, setResult] = useState<{ key: string; state: SuggestionsState } | null>(null);
  const done = useRef<string | null>(null);
  const lastConversation = useRef<string | null>(null);
  const key = anchorId ? `${conversationId}:${anchorId}` : null;

  useEffect(() => {
    if (!enabled || !key) return;
    // Ya pedidas para este mensaje (p. ej. se apagó y volvió a encender la condición): no se repite
    if (done.current === key) return;

    let cancelled = false;
    const isFirst = lastConversation.current !== conversationId;
    lastConversation.current = conversationId;

    const run = () => {
      if (cancelled) return;
      setResult({ key, state: { kind: 'loading' } });
      api
        .post<SuggestionsResponse>(`/api/conversations/${conversationId}/suggestions`)
        .then((r) => {
          if (cancelled) return;
          setResult({ key, state: r.reason === 'limit' ? { kind: 'limit' } : { kind: 'ready', items: r.suggestions ?? [] } });
          // 'pending': otra pestaña la está generando; se puede volver a pedir más tarde
          if (r.reason !== 'pending') done.current = key;
        })
        .catch(() => {
          if (!cancelled) setResult({ key, state: { kind: 'ready', items: [] } });
        });
    };

    const whenVisible = () => {
      if (document.visibilityState !== 'visible') return;
      document.removeEventListener('visibilitychange', whenVisible);
      run();
    };

    const timer = window.setTimeout(
      () => {
        if (document.visibilityState === 'visible') run();
        else document.addEventListener('visibilitychange', whenVisible);
      },
      isFirst ? 0 : NEW_MESSAGE_DELAY_MS,
    );

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', whenVisible);
    };
  }, [conversationId, key, enabled]);

  if (!enabled || !key || result?.key !== key) return IDLE;
  return result.state;
}
