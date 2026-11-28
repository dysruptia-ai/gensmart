'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type {
  ApiConversationEvent,
  ApiNote,
  LabelRef,
  CloseOutcome,
  ConversationDetail,
  DetailResponse,
  MessageRole,
  ThreadMessage,
} from './types';

const MSG_PAGE = 40;

export type ThreadEventKind =
  | 'handoff'
  | 'taken'
  | 'released'
  | 'transferred'
  | 'snoozed'
  | 'unsnoozed'
  | 'closed'
  | 'reopened'
  | 'note_deleted'
  | 'assigned';

/**
 * Evento que se pinta centrado en el hilo. Sale de `conversation_events` (web-42); en las
 * conversaciones anteriores, de los campos de la conversación. Nunca es un mensaje: el agente no lo ve.
 */
export interface ThreadEvent {
  id: string;
  kind: ThreadEventKind;
  at: string;
  actorId?: string | null;
  /** Quien lo hizo (nulo si fue el agente o el sistema). */
  name?: string | null;
  targetId?: string | null;
  targetName?: string | null;
  note?: string | null;
  until?: string | null;
  outcome?: CloseOutcome | null;
  /** web-45: el motivo del pedido de ayuda ('agent_paused') o la forma del reparto. */
  reason?: string | null;
  mode?: string | null;
}

/** Cambios que llegan en `conversation:update` (web-42). */
export interface ConversationChange {
  status?: string;
  takenOverBy?: string | null;
  takeoverUserName?: string | null;
  snoozedUntil?: string | null;
  snoozedBy?: string | null;
  snoozedByName?: string | null;
  followUpAt?: string | null;
  closedOutcome?: CloseOutcome | null;
  closedAt?: string | null;
  closedBy?: string | null;
  closedByName?: string | null;
  labels?: LabelRef[];
  event?: ApiConversationEvent;
  updatedAt: string;
}

export function fromApiEvent(e: ApiConversationEvent): ThreadEvent {
  const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
  return {
    id: e.id,
    kind: e.type === 'handoff_requested' ? 'handoff' : e.type,
    at: e.createdAt,
    actorId: e.actorUserId,
    name: e.actorName,
    targetId: e.targetUserId,
    targetName: e.targetName,
    note: str(e.data['note']),
    until: str(e.data['until']),
    outcome: (str(e.data['outcome']) as CloseOutcome | null) ?? null,
    reason: str(e.data['reason']),
    mode: str(e.data['mode']),
  };
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

/** Eventos que se pueden saber con los campos de la conversación (las anteriores a web-42). */
function fieldEvents(c: ConversationDetail): ThreadEvent[] {
  const events: ThreadEvent[] = [];
  if (c.handedOffAt) events.push({ id: `handoff-${c.handedOffAt}`, kind: 'handoff', at: c.handedOffAt });
  if (c.status === 'human_takeover' && c.takenOverAt) {
    events.push({ id: `taken-${c.takenOverAt}`, kind: 'taken', at: c.takenOverAt, name: c.takeoverUserName, actorId: c.takenOverBy });
  }
  if (c.status === 'closed') {
    const at = c.closedAt ?? c.updatedAt;
    events.push({ id: `closed-${at}`, kind: 'closed', at, name: c.closedByName ?? null, actorId: c.closedBy ?? null, outcome: c.closedOutcome ?? null });
  }
  return events;
}

/**
 * El historial: los eventos guardados y, de los que se arman con los campos, solo los anteriores
 * al primero guardado (así una conversación vieja que se reabre conserva "El agente pidió ayuda").
 */
export function buildEvents(c: ConversationDetail, stored: ApiConversationEvent[] | undefined): ThreadEvent[] {
  const saved = (stored ?? []).map(fromApiEvent);
  if (!saved.length) return fieldEvents(c);
  // El campo y el evento se escriben casi a la vez (handed_off_at y handoff_requested, por ejemplo):
  // margen de unos segundos para no repetirlo. Un "taken" armado con los campos lleva el nombre de quien
  // la tiene hoy, así que no se muestra si ya hay tomas o transferencias guardadas.
  const first = new Date(saved[0]!.at).getTime() - 5000;
  const hasHandover = saved.some((e) => e.kind === 'taken' || e.kind === 'transferred');
  const older = fieldEvents(c).filter(
    (e) => new Date(e.at).getTime() < first && !(e.kind === 'taken' && hasHandover),
  );
  return [...older, ...saved];
}

export type ThreadAction = 'take' | 'release' | 'close' | 'reopen' | 'transfer' | 'snooze' | 'unsnooze' | 'delete';

interface ActionResult {
  change: Omit<ConversationChange, 'updatedAt'>;
}

let tmpSeq = 0;

export function useConversationThread(conversationId: string | null, me: Me | null) {
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [events, setEvents] = useState<ThreadEvent[]>([]);
  // Notas internas (web-43): fuera de `messages`, el agente nunca las lee
  const [notes, setNotes] = useState<ApiNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<'not_found' | 'failed' | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [oldest, setOldest] = useState<string | null>(null);
  const [busy, setBusy] = useState<ThreadAction | null>(null);
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
      setNotes([]);
      setError(null);
      setLoading(false);
      return;
    }
    if (!options?.quiet) {
      setLoading(true);
      commit(null);
      setMessages([]);
      setEvents([]);
      setNotes([]);
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
        setEvents(buildEvents(data.conversation, data.events));
        setNotes(data.notes ?? []);
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
        // Tomarla atiende el pedido de ayuda: al devolverla al agente no vuelve a "pidió ayuda" (web-42b)
        commit({ ...prev, status: 'human_takeover', takenOverBy: userId, takeoverUserName: name, takenOverAt: at, snoozedUntil: null, handoffActive: false });
      } else {
        if (prev.status !== 'human_takeover') return;
        commit({ ...prev, status: 'active', takenOverBy: null, takeoverUserName: null, takenOverAt: null });
      }
      // El evento del historial llega aparte (respuesta de la acción o `conversation:update`)
    },
    [commit],
  );

  const applyClosed = useCallback(
    (at: string) => {
      const prev = convRef.current;
      if (!prev || prev.status === 'closed') return;
      commit({ ...prev, status: 'closed', updatedAt: at, closedAt: prev.closedAt ?? at, needsAttention: false, waitingSince: null });
    },
    [commit],
  );

  /** Aplica un `conversation:update` (propio o de otra persona): campos y, si viene, el evento nuevo. */
  const applyChange = useCallback(
    (change: ConversationChange) => {
      const prev = convRef.current;
      if (!prev) return;
      const next: ConversationDetail = { ...prev, updatedAt: change.updatedAt };
      if (change.status === 'active' || change.status === 'human_takeover' || change.status === 'closed') next.status = change.status;
      if (change.takenOverBy !== undefined) next.takenOverBy = change.takenOverBy;
      // Tomada o recibida por transferencia: el pedido de ayuda queda atendido (web-42b)
      if (change.takenOverBy) next.handoffActive = false;
      if (change.takeoverUserName !== undefined) next.takeoverUserName = change.takeoverUserName;
      if (change.snoozedUntil !== undefined) next.snoozedUntil = change.snoozedUntil;
      if (change.snoozedBy !== undefined) next.snoozedBy = change.snoozedBy;
      if (change.snoozedByName !== undefined) next.snoozedByName = change.snoozedByName;
      if (change.followUpAt !== undefined) next.followUpAt = change.followUpAt;
      if (change.closedOutcome !== undefined) next.closedOutcome = change.closedOutcome;
      if (change.closedAt !== undefined) next.closedAt = change.closedAt;
      if (change.closedBy !== undefined) next.closedBy = change.closedBy;
      if (change.closedByName !== undefined) next.closedByName = change.closedByName;
      if (change.labels !== undefined) next.labels = change.labels;
      if (next.status === 'closed' || next.snoozedUntil) {
        next.needsAttention = false;
        next.waitingSince = null;
      }
      commit(next);
      if (change.event) pushEvent(fromApiEvent(change.event));
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
    async (kind: ThreadAction, errorKey: string, request: (id: string) => Promise<ActionResult>): Promise<boolean> => {
      const id = idRef.current;
      if (!id || !me) return false;
      setBusy(kind);
      setActionError(null);
      try {
        const result = await request(id);
        if (kind === 'delete') return true;
        // El cambio se ve al instante; el eco por WebSocket trae lo mismo (el evento no se repite: mismo id)
        if (idRef.current === id) applyChange({ ...result.change, updatedAt: new Date().toISOString() });
        return true;
      } catch (err) {
        const code = err instanceof ApiError ? err.code : undefined;
        // Otra persona se adelantó (o ya estaba cerrada): se muestra el estado real
        if (
          code === 'ALREADY_TAKEN_OVER' ||
          code === 'ALREADY_CLOSED' ||
          code === 'NOT_IN_TAKEOVER' ||
          code === 'FORBIDDEN' ||
          code === 'NOT_CLOSED' ||
          code === 'NOT_SNOOZED' ||
          code === 'SAME_USER'
        ) {
          load({ quiet: true });
        }
        setActionError(errorKey);
        return false;
      } finally {
        setBusy(null);
      }
    },
    [me, applyChange, load],
  );

  const take = useCallback(
    () =>
      runAction('take', 'inbox.errors.take', async (id) => {
        const r = await api.post<{ event?: ApiConversationEvent }>(`/api/conversations/${id}/takeover`);
        return { change: { status: 'human_takeover', takenOverBy: me?.id ?? null, takeoverUserName: me?.name ?? null, snoozedUntil: null, event: r.event } };
      }),
    [runAction, me],
  );
  const release = useCallback(
    () =>
      runAction('release', 'inbox.errors.release', async (id) => {
        const r = await api.post<{ event?: ApiConversationEvent }>(`/api/conversations/${id}/release`);
        return { change: { status: 'active', takenOverBy: null, takeoverUserName: null, event: r.event } };
      }),
    [runAction],
  );
  const close = useCallback(
    (outcome: CloseOutcome | null) =>
      runAction('close', 'inbox.errors.close', async (id) => {
        const r = await api.put<{ closedAt?: string; event?: ApiConversationEvent }>(
          `/api/conversations/${id}/close`,
          outcome ? { outcome } : {},
        );
        return {
          change: {
            status: 'closed',
            closedOutcome: outcome,
            closedAt: r.closedAt ?? new Date().toISOString(),
            closedBy: me?.id ?? null,
            closedByName: me?.name ?? null,
            snoozedUntil: null,
            followUpAt: null,
            event: r.event,
          },
        };
      }),
    [runAction, me],
  );
  const reopen = useCallback(
    () =>
      runAction('reopen', 'inbox.errors.reopen', async (id) => {
        const r = await api.post<{ event?: ApiConversationEvent }>(`/api/conversations/${id}/reopen`);
        return {
          change: {
            status: 'active',
            takenOverBy: null,
            takeoverUserName: null,
            closedOutcome: null,
            closedAt: null,
            closedBy: null,
            closedByName: null,
            event: r.event,
          },
        };
      }),
    [runAction],
  );
  /** `toUserId = null`: devolver al agente. `toUserId = me.id` (owner/admin): "Tomarla tú". */
  const transfer = useCallback(
    (toUserId: string | null, toName: string | null, note: string) =>
      runAction('transfer', 'inbox.errors.transfer', async (id) => {
        const r = await api.post<{ event?: ApiConversationEvent }>(`/api/conversations/${id}/transfer`, {
          toUserId,
          ...(note.trim() ? { note: note.trim() } : {}),
        });
        return {
          change: toUserId
            ? { status: 'human_takeover', takenOverBy: toUserId, takeoverUserName: toName, snoozedUntil: null, event: r.event }
            : { status: 'active', takenOverBy: null, takeoverUserName: null, event: r.event },
        };
      }),
    [runAction],
  );
  const snooze = useCallback(
    (until: Date) =>
      runAction('snooze', 'inbox.errors.snooze', async (id) => {
        const r = await api.post<{ snoozedUntil: string; event?: ApiConversationEvent }>(`/api/conversations/${id}/snooze`, {
          until: until.toISOString(),
        });
        return {
          change: { snoozedUntil: r.snoozedUntil, snoozedBy: me?.id ?? null, snoozedByName: me?.name ?? null, followUpAt: null, event: r.event },
        };
      }),
    [runAction, me],
  );
  const unsnooze = useCallback(
    () =>
      runAction('unsnooze', 'inbox.errors.unsnooze', async (id) => {
        const r = await api.delete<{ event?: ApiConversationEvent }>(`/api/conversations/${id}/snooze`);
        return { change: { snoozedUntil: null, event: r.event } };
      }),
    [runAction],
  );
  const remove = useCallback(
    () =>
      runAction('delete', 'inbox.errors.delete', async (id) => {
        await api.delete(`/api/conversations/${id}`);
        return { change: {} };
      }),
    [runAction],
  );

  // ── notas internas (web-43) ──────────────────────────────────────────────
  const addNote = useCallback((conversation: string, note: ApiNote) => {
    if (conversation !== idRef.current) return;
    setNotes((prev) => (prev.some((n) => n.id === note.id) ? prev : [...prev, note]));
  }, []);

  /** Quita la nota y pinta "X borró una nota" (llega por la respuesta o por `conversation:note-deleted`). */
  const dropNote = useCallback(
    (conversation: string, noteId: string, event?: ApiConversationEvent | null) => {
      if (conversation !== idRef.current) return;
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      if (event) pushEvent(fromApiEvent(event));
    },
    [pushEvent],
  );

  const saveNote = useCallback(
    async (body: string): Promise<boolean> => {
      const id = idRef.current;
      if (!id) return false;
      try {
        const r = await api.post<{ note: ApiNote }>(`/api/conversations/${id}/notes`, { body });
        addNote(id, r.note);
        return true;
      } catch {
        return false;
      }
    },
    [addNote],
  );

  const deleteNote = useCallback(
    async (noteId: string): Promise<boolean> => {
      const id = idRef.current;
      if (!id) return false;
      try {
        const r = await api.delete<{ event?: ApiConversationEvent | null }>(`/api/conversations/${id}/notes/${noteId}`);
        dropNote(id, noteId, r.event);
        return true;
      } catch (err) {
        // Ya la había borrado otra persona: se quita igual
        if (err instanceof ApiError && err.status === 404) dropNote(id, noteId);
        return false;
      }
    },
    [dropNote],
  );

  // ── etiquetas (web-43): optimista, con vuelta atrás si la API falla ──────
  const setLabels = useCallback(
    async (next: LabelRef[]): Promise<boolean> => {
      const id = idRef.current;
      const prev = convRef.current;
      if (!id || !prev) return false;
      const before = prev.labels ?? [];
      const sorted = [...next].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
      commit({ ...prev, labels: sorted });
      try {
        const r = await api.put<{ labels: LabelRef[] }>(`/api/conversations/${id}/labels`, { labelIds: sorted.map((l) => l.id) });
        const current = convRef.current;
        if (current && current.id === id) commit({ ...current, labels: r.labels });
        return true;
      } catch {
        const current = convRef.current;
        if (current && current.id === id) commit({ ...current, labels: before });
        setActionError('inbox.errors.labels');
        return false;
      }
    },
    [commit],
  );

  return {
    conversation,
    messages,
    events,
    notes,
    addNote,
    dropNote,
    saveNote,
    deleteNote,
    setLabels,
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
    applyChange,
    patchConversation,
    send,
    retry,
    discard,
    take,
    release,
    close,
    reopen,
    transfer,
    snooze,
    unsnooze,
    remove,
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
