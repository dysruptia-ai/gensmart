'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type { ConversationDetail, DetailResponse, MessageRole, ThreadMessage } from './types';

const MSG_PAGE = 40;

/** Evento del sistema que se pinta centrado en el hilo. No se guarda como mensaje (ver reporte web-41). */
export interface ThreadEvent {
  id: string;
  kind: 'handoff' | 'taken' | 'released' | 'closed';
  at: string;
  name?: string | null;
}

export interface OutgoingImage {
  data: string;
  mimeType: string;
}

export interface SendPayload {
  content: string;
  image?: OutgoingImage;
  audio?: OutgoingImage;
}

interface Me {
  id: string;
  name: string;
}

/** Eventos que se pueden saber con los campos de la conversación al abrirla. */
function initialEvents(c: ConversationDetail): ThreadEvent[] {
  const events: ThreadEvent[] = [];
  if (c.handedOffAt) events.push({ id: `handoff-${c.handedOffAt}`, kind: 'handoff', at: c.handedOffAt });
  if (c.status === 'human_takeover' && c.takenOverAt) {
    events.push({ id: `taken-${c.takenOverAt}`, kind: 'taken', at: c.takenOverAt, name: c.takeoverUserName });
  }
  if (c.status === 'closed') events.push({ id: `closed-${c.updatedAt}`, kind: 'closed', at: c.updatedAt });
  return events;
}

let tmpSeq = 0;

export function useConversationThread(conversationId: string | null, me: Me | null) {
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [events, setEvents] = useState<ThreadEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<'not_found' | 'failed' | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [oldest, setOldest] = useState<string | null>(null);
  const [busy, setBusy] = useState<'take' | 'release' | 'close' | 'delete' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const requestId = useRef(0);
  const pending = useRef(new Map<string, SendPayload>());
  // Copia síncrona del detalle: el eco por WebSocket de una acción propia llega antes del render
  const convRef = useRef<ConversationDetail | null>(null);
  const commit = useCallback((next: ConversationDetail | null) => {
    convRef.current = next;
    setConversation(next);
  }, []);
  const idRef = useRef(conversationId);
  idRef.current = conversationId;

  const load = useCallback((options?: { quiet?: boolean }) => {
    const id = idRef.current;
    const req = ++requestId.current;
    if (!id) {
      commit(null);
      setMessages([]);
      setEvents([]);
      setError(null);
      setLoading(false);
      return;
    }
    if (!options?.quiet) {
      setLoading(true);
      commit(null);
      setMessages([]);
      setEvents([]);
      setActionError(null);
    }
    setError(null);
    api
      .get<DetailResponse>(`/api/conversations/${id}?msgLimit=${MSG_PAGE}`)
      .then((data) => {
        if (req !== requestId.current) return;
        commit(data.conversation);
        // Al recargar en silencio se conservan los propios que siguen enviándose o fallaron
        setMessages((prev) => [...data.messages, ...(options?.quiet ? prev.filter((m) => m.delivery) : [])]);
        setEvents(initialEvents(data.conversation));
        setHasMore(data.pagination.hasMore);
        setOldest(data.pagination.oldestTimestamp);
      })
      .catch((err: unknown) => {
        if (req !== requestId.current) return;
        const status = err instanceof ApiError ? err.status : 0;
        setError(status === 404 || status === 400 ? 'not_found' : 'failed');
      })
      .finally(() => {
        if (req === requestId.current) setLoading(false);
      });
  }, [commit]);

  useEffect(() => {
    load();
  }, [load, conversationId]);

  const loadOlder = useCallback(async (): Promise<boolean> => {
    const id = idRef.current;
    if (!id || !hasMore || !oldest || loadingOlder) return false;
    setLoadingOlder(true);
    try {
      const data = await api.get<DetailResponse>(
        `/api/conversations/${id}?msgLimit=${MSG_PAGE}&msgBefore=${encodeURIComponent(oldest)}`,
      );
      if (id !== idRef.current) return false;
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        return [...data.messages.filter((m) => !seen.has(m.id)), ...prev];
      });
      setHasMore(data.pagination.hasMore);
      setOldest(data.pagination.oldestTimestamp);
      return true;
    } catch {
      return false;
    } finally {
      setLoadingOlder(false);
    }
  }, [hasMore, oldest, loadingOlder]);

  // ── tiempo real ──────────────────────────────────────────────────────────
  const addMessages = useCallback((incoming: ThreadMessage[]) => {
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      let next = prev;
      for (const msg of incoming) {
        if (seen.has(msg.id)) continue;
        // El eco de un mensaje propio reemplaza al que se estaba enviando
        const tmpIndex =
          msg.role === 'human'
            ? next.findIndex((m) => m.delivery === 'sending' && m.role === 'human' && m.content === msg.content)
            : -1;
        if (tmpIndex >= 0) {
          pending.current.delete(next[tmpIndex]!.id);
          next = next.map((m, i) => (i === tmpIndex ? msg : m));
        } else {
          next = [...next, msg];
        }
        seen.add(msg.id);
      }
      return next;
    });
    const lastUser = [...incoming].reverse().find((m) => m.role === 'user');
    const prev = convRef.current;
    if (lastUser && prev) commit({ ...prev, lastCustomerMessageAt: lastUser.createdAt });
  }, [commit]);

  const pushEvent = useCallback((event: ThreadEvent) => {
    setEvents((prev) => (prev.some((e) => e.id === event.id) ? prev : [...prev, event]));
  }, []);

  const applyTakeover = useCallback(
    (status: string, userId: string | null, name: string | null, at: string) => {
      const prev = convRef.current;
      if (!prev) return;
      if (status === 'human_takeover') {
        if (prev.status === 'human_takeover' && prev.takenOverBy === userId) return;
        commit({ ...prev, status: 'human_takeover', takenOverBy: userId, takeoverUserName: name, takenOverAt: at });
        pushEvent({ id: `taken-${at}`, kind: 'taken', at, name });
      } else {
        if (prev.status !== 'human_takeover') return;
        commit({ ...prev, status: 'active', takenOverBy: null, takeoverUserName: null, takenOverAt: null });
        pushEvent({ id: `released-${at}`, kind: 'released', at });
      }
    },
    [commit, pushEvent],
  );

  const applyClosed = useCallback(
    (at: string) => {
      const prev = convRef.current;
      if (!prev || prev.status === 'closed') return;
      commit({ ...prev, status: 'closed', updatedAt: at, needsAttention: false, waitingSince: null });
      pushEvent({ id: `closed-${at}`, kind: 'closed', at });
    },
    [commit, pushEvent],
  );

  const applyHandoff = useCallback(
    (at: string) => {
      const prev = convRef.current;
      if (!prev || (prev.handoffActive && prev.handedOffAt === at)) return;
      commit({ ...prev, handoffActive: true, handedOffAt: at });
      pushEvent({ id: `handoff-${at}`, kind: 'handoff', at });
    },
    [commit, pushEvent],
  );

  const patchConversation = useCallback(
    (fn: (c: ConversationDetail) => ConversationDetail) => {
      const prev = convRef.current;
      if (prev) commit(fn(prev));
    },
    [commit],
  );

  // ── acciones ─────────────────────────────────────────────────────────────
  const send = useCallback(
    async (payload: SendPayload, retryId?: string): Promise<boolean> => {
      const id = idRef.current;
      if (!id || !me) return false;
      const tmpId = retryId ?? `tmp-${Date.now()}-${++tmpSeq}`;
      pending.current.set(tmpId, payload);
      const optimistic: ThreadMessage = {
        id: tmpId,
        role: 'human',
        content: payload.content || (payload.audio ? '…' : payload.image ? '[Image]' : ''),
        metadata: {
          sentBy: { id: me.id, name: me.name },
          ...(payload.image ? { hasImages: true, imageCount: 1, images: [{ mimeType: payload.image.mimeType, data: payload.image.data }] } : {}),
          ...(payload.audio ? { isVoiceMessage: true } : {}),
        },
        createdAt: new Date().toISOString(),
        delivery: 'sending',
      };
      setMessages((prev) => (retryId ? prev.map((m) => (m.id === retryId ? optimistic : m)) : [...prev, optimistic]));
      try {
        const result = await api.post<{ message: ThreadMessage }>(`/api/conversations/${id}/message`, {
          content: payload.content || undefined,
          image: payload.image,
          audio: payload.audio,
        });
        pending.current.delete(tmpId);
        setMessages((prev) => {
          if (prev.some((m) => m.id === result.message.id)) return prev.filter((m) => m.id !== tmpId);
          return prev.map((m) => (m.id === tmpId ? { ...result.message, metadata: result.message.metadata ?? {} } : m));
        });
        return true;
      } catch {
        setMessages((prev) => prev.map((m) => (m.id === tmpId ? { ...m, delivery: 'failed' } : m)));
        return false;
      }
    },
    [me],
  );

  const retry = useCallback(
    (tmpId: string) => {
      const payload = pending.current.get(tmpId);
      if (payload) void send(payload, tmpId);
    },
    [send],
  );

  const discard = useCallback((tmpId: string) => {
    pending.current.delete(tmpId);
    setMessages((prev) => prev.filter((m) => m.id !== tmpId));
  }, []);

  const runAction = useCallback(
    async (kind: 'take' | 'release' | 'close' | 'delete', errorKey: string): Promise<boolean> => {
      const id = idRef.current;
      if (!id || !me) return false;
      setBusy(kind);
      setActionError(null);
      try {
        if (kind === 'take') await api.post(`/api/conversations/${id}/takeover`);
        if (kind === 'release') await api.post(`/api/conversations/${id}/release`);
        if (kind === 'close') await api.put(`/api/conversations/${id}/close`);
        if (kind === 'delete') {
          await api.delete(`/api/conversations/${id}`);
          return true;
        }
        const at = new Date().toISOString();
        if (kind === 'take') applyTakeover('human_takeover', me.id, me.name, at);
        if (kind === 'release') applyTakeover('active', null, null, at);
        if (kind === 'close') applyClosed(at);
        return true;
      } catch (err) {
        const code = err instanceof ApiError ? err.code : undefined;
        // Otra persona se adelantó (o ya estaba cerrada): se muestra el estado real
        if (code === 'ALREADY_TAKEN_OVER' || code === 'ALREADY_CLOSED' || code === 'NOT_IN_TAKEOVER' || code === 'FORBIDDEN') {
          load({ quiet: true });
        }
        setActionError(errorKey);
        return false;
      } finally {
        setBusy(null);
      }
    },
    [me, applyTakeover, applyClosed, load],
  );

  return {
    conversation,
    messages,
    events,
    loading,
    error,
    hasMore,
    loadingOlder,
    busy,
    actionError,
    clearActionError: () => setActionError(null),
    reload: load,
    loadOlder,
    addMessages,
    applyTakeover,
    applyClosed,
    applyHandoff,
    patchConversation,
    send,
    retry,
    discard,
    take: () => runAction('take', 'inbox.errors.take'),
    release: () => runAction('release', 'inbox.errors.release'),
    close: () => runAction('close', 'inbox.errors.close'),
    remove: () => runAction('delete', 'inbox.errors.delete'),
  };
}

export type ConversationThreadState = ReturnType<typeof useConversationThread>;

/** Normaliza los mensajes que llegan por `message:new` (con o sin arreglo, con o sin id). */
export function normalizeIncoming(data: {
  messages?: Array<{ id?: string; role: string; content: string; metadata?: Record<string, unknown>; createdAt?: string }>;
  role?: string;
  content?: string;
}): ThreadMessage[] {
  const raw = data.messages ?? (data.role ? [{ role: data.role, content: data.content ?? '' }] : []);
  return raw.map((m, i) => ({
    id: ('id' in m && m.id) || `ws-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`,
    role: m.role as MessageRole,
    content: m.content,
    metadata: ('metadata' in m && m.metadata) || {},
    createdAt: ('createdAt' in m && m.createdAt) || new Date().toISOString(),
  }));
}
