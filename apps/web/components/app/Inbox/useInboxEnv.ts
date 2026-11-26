'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { storageGet, storageSet } from '@/lib/safe-storage';

/** `true` mientras la media query se cumpla (en el servidor, `serverValue`). */
export function useMediaQuery(query: string, serverValue = false): boolean {
  return useSyncExternalStore(
    (listener) => {
      const media = window.matchMedia(query);
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    },
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

/** Desde 1180 px: riel de la Bandeja fijo. */
export const WIDE_QUERY = '(min-width: 1180px)';
/** Desde 1600 px: la ficha es una columna fija; por debajo, un panel que se abre con "Detalles". */
export const DETAILS_FIXED_QUERY = '(min-width: 1600px)';
/** Menos de 768 px: una sola columna (lista o hilo). */
export const MOBILE_QUERY = '(max-width: 767.98px)';

/** La hora actual, renovada cada `intervalMs` (para "hace 5 min" y "Espera 12 min"). */
export function useNow(intervalMs = 30000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/**
 * Conexión en tiempo real y de red. `online` es falso si el navegador está sin red o el socket
 * se cayó. `onReconnect` se llama cada vez que vuelve, para recargar lo que se pudo perder.
 */
export function useConnection(onReconnect: () => void): { online: boolean } {
  const { on, off } = useWebSocket();
  const network = useSyncExternalStore(
    (listener) => {
      window.addEventListener('online', listener);
      window.addEventListener('offline', listener);
      return () => {
        window.removeEventListener('online', listener);
        window.removeEventListener('offline', listener);
      };
    },
    () => navigator.onLine,
    () => true,
  );
  const [socket, setSocket] = useState(true);
  const wasOffline = useRef(false);
  const reconnectRef = useRef(onReconnect);
  useLayoutEffect(() => {
    reconnectRef.current = onReconnect;
  });

  useEffect(() => {
    const handleConnect = () => setSocket(true);
    const handleDisconnect = () => setSocket(false);
    on('connect', handleConnect);
    on('disconnect', handleDisconnect);
    // El socket puede tardar en crearse (token): no se marca caído hasta que avise
    return () => {
      off('connect', handleConnect);
      off('disconnect', handleDisconnect);
    };
  }, [on, off]);

  const online = network && socket;
  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      return;
    }
    if (wasOffline.current) {
      wasOffline.current = false;
      reconnectRef.current();
    }
  }, [online]);

  return { online };
}

// ── "Detalles" abierto o cerrado (por debajo de 1600 px), recordado entre visitas ──
const DETAILS_KEY = 'gs.inbox.details';
const detailsListeners = new Set<() => void>();

function subscribeDetails(listener: () => void): () => void {
  detailsListeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    detailsListeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

/** `[abierto, cambiar]`. Por defecto cerrado; si el navegador bloquea el almacenamiento, dura lo que dure la página. */
export function useDetailsPreference(): [boolean, (open: boolean) => void] {
  const [fallback, setFallback] = useState<boolean | null>(null);
  const stored = useSyncExternalStore(
    subscribeDetails,
    () => storageGet(DETAILS_KEY),
    () => null,
  );
  const open = fallback ?? stored === 'open';
  const set = useCallback((next: boolean) => {
    storageSet(DETAILS_KEY, next ? 'open' : 'closed');
    // Si no se pudo guardar, se recuerda en memoria
    setFallback(storageGet(DETAILS_KEY) === null ? next : null);
    detailsListeners.forEach((l) => l());
  }, []);
  return [open, set];
}
