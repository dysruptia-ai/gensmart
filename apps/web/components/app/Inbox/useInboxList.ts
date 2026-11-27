'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { listApiQuery, rowMatches, savedViewAsFilters, sortRows, withNeeds } from './inboxFormat';
import type { ConversationRow, InboxCounts, InboxFilters, LabelRef, ListResponse, MessageRole, SavedViewFilters } from './types';

const PAGE_SIZE = 30;

export interface RowPatch {
  conversationId: string;
  /** Mensaje nuevo (sube la conversación y cambia el último mensaje). */
  message?: { role: MessageRole; content: string; createdAt: string; sentByName?: string | null; sentById?: string | null };
  status?: ConversationRow['status'];
  takenOverBy?: string | null;
  takeoverUserName?: string | null;
  handoffAt?: string;
  aiScore?: number;
  /** Sin leer para quien mira (web-44). */
  unread?: boolean;
  /** Campos de web-42 (posponer, cerrar con resultado) tal como llegan en `conversation:update`. */
  fields?: Partial<
    Pick<
      ConversationRow,
      | 'snoozedUntil'
      | 'snoozedBy'
      | 'followUpAt'
      | 'followUpPending'
      | 'closedOutcome'
      | 'closedAt'
      | 'closedBy'
      | 'closedByName'
      | 'labels'
    >
  >;
}

export interface InboxList {
  rows: ConversationRow[];
  total: number;
  /** No leídas con los filtros actuales (web-44). */
  unreadCount: number;
  loading: boolean;
  loadingMore: boolean;
  error: boolean;
  hasMore: boolean;
  reload: () => void;
  loadMore: () => void;
  /** Aplica un evento en tiempo real. Si la conversación no está cargada, trae solo la primera página y la mezcla. */
  patch: (p: RowPatch) => void;
  /** Quita una conversación (se borró). */
  remove: (id: string) => void;
  /** Cambia las etiquetas de todas las filas cargadas (se renombró o borró una del catálogo). */
  mapLabels: (fn: (labels: LabelRef[]) => LabelRef[]) => void;
  /** Cambia el leído de una fila (y el número de no leídas) al instante. */
  setUnread: (id: string, unread: boolean) => void;
}

/** El orden local de la lista: el de la vista, el del segmentado de Todas, o por recientes al buscar. */
function sortFor(rows: ConversationRow[], filters: InboxFilters, saved: SavedViewFilters | null | undefined, searching: boolean) {
  if (searching) return sortRows(rows, 'all', 'recent');
  if (saved) return sortRows(rows, savedViewAsFilters(saved).view, 'recent');
  return sortRows(rows, filters.view, filters.order);
}

/** Lista paginada de la Bandeja. Nunca carga todas de una vez ni se vuelve a pedir entera con cada evento. */
export function useInboxList(
  filters: InboxFilters,
  search: string,
  userId: string | undefined,
  saved?: SavedViewFilters | null,
): InboxList {
  const [rows, setRows] = useState<ConversationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  // La consulta actual (filtros, búsqueda y recargas) y cuál fue la última que terminó
  const [nonce, setNonce] = useState(0);
  const queryKey = `${listApiQuery(filters, search, 1, PAGE_SIZE)}#${nonce}`;
  const [settled, setSettled] = useState<{ key: string; ok: boolean } | null>(null);
  const loading = settled?.key !== queryKey;
  const error = !loading && settled?.ok === false;

  const requestId = useRef(0);
  const filtersRef = useRef(filters);
  const searchRef = useRef(search);
  const userRef = useRef(userId);
  const rowsRef = useRef(rows);
  const savedRef = useRef(saved);
  useLayoutEffect(() => {
    savedRef.current = saved;
    filtersRef.current = filters;
    searchRef.current = search;
    userRef.current = userId;
    rowsRef.current = rows;
  });

  const fetchPage = useCallback(
    (pageNum: number) =>
      api.get<ListResponse>(`/api/conversations?${listApiQuery(filtersRef.current, searchRef.current, pageNum, PAGE_SIZE)}`),
    [],
  );

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    const id = ++requestId.current;
    fetchPage(1)
      .then((data) => {
        if (id !== requestId.current) return;
        setRows(data.conversations);
        setTotal(data.pagination.total);
        setUnreadCount(data.unreadCount ?? 0);
        setTotalPages(data.pagination.totalPages);
        setPage(1);
        setSettled({ key: queryKey, ok: true });
      })
      .catch(() => {
        if (id === requestId.current) setSettled({ key: queryKey, ok: false });
      });
  }, [fetchPage, queryKey]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || page >= totalPages) return;
    const id = requestId.current;
    setLoadingMore(true);
    fetchPage(page + 1)
      .then((data) => {
        if (id !== requestId.current) return;
        setRows((prev) => {
          const seen = new Set(prev.map((r) => r.id));
          return [...prev, ...data.conversations.filter((r) => !seen.has(r.id))];
        });
        setTotal(data.pagination.total);
        setTotalPages(data.pagination.totalPages);
        setPage(page + 1);
      })
      .catch(() => {
        /* el botón "Cargar más" sigue ahí para reintentar */
      })
      .finally(() => setLoadingMore(false));
  }, [fetchPage, loading, loadingMore, page, totalPages]);

  // Conversaciones que no están cargadas: una sola petición de la primera página, agrupada
  const mergeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mergeFirstPage = useCallback(() => {
    if (mergeTimer.current) return;
    mergeTimer.current = setTimeout(() => {
      mergeTimer.current = null;
      const id = requestId.current;
      fetchPage(1)
        .then((data) => {
          if (id !== requestId.current) return;
          setRows((prev) => {
            const fresh = new Map(data.conversations.map((r) => [r.id, r]));
            const kept = prev.map((r) => fresh.get(r.id) ?? r);
            const keptIds = new Set(kept.map((r) => r.id));
            const added = data.conversations.filter((r) => !keptIds.has(r.id));
            return sortFor([...added, ...kept], filtersRef.current, savedRef.current, !!searchRef.current);
          });
          setTotal(data.pagination.total);
          setUnreadCount(data.unreadCount ?? 0);
        })
        .catch(() => {
          /* el próximo evento o la reconexión lo vuelven a intentar */
        });
    }, 700);
  }, [fetchPage]);

  useEffect(
    () => () => {
      if (mergeTimer.current) clearTimeout(mergeTimer.current);
    },
    [],
  );

  const patch = useCallback(
    (p: RowPatch) => {
      const current = rowsRef.current.find((r) => r.id === p.conversationId);
      if (!current) {
        if (!searchRef.current) mergeFirstPage();
        return;
      }
      // El número de "Sin leer" se ajusta fuera del updater (React puede llamarlo dos veces)
      if (p.unread !== undefined && p.unread !== !!current.unread) setUnreadCount((n) => Math.max(0, n + (p.unread ? 1 : -1)));
      setRows((prev) => {
        const index = prev.findIndex((r) => r.id === p.conversationId);
        if (index < 0) return prev;
        let row: ConversationRow = { ...prev[index]! };
        let lastCustomerAt = row.waitingSince;
        if (p.message) {
          row.lastMessage = {
            content: p.message.content.slice(0, 100),
            role: p.message.role,
            sentByName: p.message.sentByName ?? null,
            sentById: p.message.sentById ?? null,
          };
          if (p.message.role !== 'system') row.lastMessageAt = p.message.createdAt;
          if (p.message.role === 'user') lastCustomerAt = p.message.createdAt;
          // Respondida después de volver de posponer: sale de "Seguimiento para hoy"
          if (p.message.role === 'human' || p.message.role === 'assistant') row.followUpPending = false;
        }
        if (p.fields) {
          row = { ...row, ...p.fields };
          // Acaba de volver de posponer: queda en "Seguimiento para hoy" hasta que alguien responda
          if (p.fields.followUpAt) row.followUpPending = true;
          if (p.fields.followUpAt === null) row.followUpPending = false;
        }
        if (p.status) row.status = p.status;
        if (p.takenOverBy !== undefined) row.takenOverBy = p.takenOverBy;
        // Tomada o transferida: el pedido de ayuda queda atendido (web-42b)
        if (p.takenOverBy) row.handoffActive = false;
        if (p.takeoverUserName !== undefined) row.takeoverUserName = p.takeoverUserName;
        if (p.handoffAt) {
          row.handoffActive = true;
          row.handedOffAt = p.handoffAt;
        }
        if (p.aiScore !== undefined) row.aiScore = p.aiScore;
        if (p.unread !== undefined) row.unread = p.unread;
        row = withNeeds(row, lastCustomerAt);

        const next = [...prev];
        if (!rowMatches(row, filtersRef.current, userRef.current, savedRef.current, !!searchRef.current)) {
          next.splice(index, 1);
          return next;
        }
        next[index] = row;
        return sortFor(next, filtersRef.current, savedRef.current, !!searchRef.current);
      });
    },
    [mergeFirstPage],
  );

  const remove = useCallback((id: string) => {
    if (!rowsRef.current.some((r) => r.id === id)) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
    setTotal((n) => Math.max(0, n - 1));
  }, []);

  const setUnread = useCallback((id: string, unread: boolean) => {
    const current = rowsRef.current.find((r) => r.id === id);
    if (!current || !!current.unread === unread) return;
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, unread } : r)));
    setUnreadCount((n) => Math.max(0, n + (unread ? 1 : -1)));
  }, []);

  const mapLabels = useCallback((fn: (labels: LabelRef[]) => LabelRef[]) => {
    setRows((prev) => prev.map((r) => (r.labels?.length ? { ...r, labels: fn(r.labels) } : r)));
  }, []);

  return {
    rows,
    total,
    unreadCount,
    loading,
    loadingMore,
    error,
    hasMore: page < totalPages,
    reload,
    loadMore,
    patch,
    remove,
    mapLabels,
    setUnread,
  };
}

/** Contadores del riel (`GET /api/conversations/counts`). `refresh` agrupa las llamadas seguidas. */
export function useInboxCounts(allTime: boolean): { counts: InboxCounts | null; refresh: () => void } {
  const [counts, setCounts] = useState<InboxCounts | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const allTimeRef = useRef(allTime);
  useLayoutEffect(() => {
    allTimeRef.current = allTime;
  });

  const load = useCallback(() => {
    api
      .get<InboxCounts>(`/api/conversations/counts${allTimeRef.current ? '?range=all' : ''}`)
      .then(setCounts)
      .catch(() => {
        /* se quedan los últimos contadores */
      });
  }, []);

  useEffect(() => {
    load();
  }, [load, allTime]);

  const refresh = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(load, 500);
  }, [load]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return { counts, refresh };
}
