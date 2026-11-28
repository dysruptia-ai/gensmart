'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Clock, Filter, PauseCircle, SquareCheck, Trash2, WifiOff, X } from 'lucide-react';
import { INBOX_LIMITS, PLAN_LIMITS } from '@gensmart/shared';
import { api } from '@/lib/api';
import { trapTab } from '@/lib/focus-trap';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/hooks/useTranslation';
import { useWebSocket, type WebSocketEvents } from '@/hooks/useWebSocket';
import { useOrgAgents } from '@/components/app/AppShell/useShellData';
import AgentStrip, { type AgentPause } from './AgentStrip';
import BulkBar from './BulkBar';
import ChannelIssueNotice from './ChannelIssueNotice';
import InboxGoalBar from './InboxGoalBar';
import InboxNotice from './InboxNotice';
import { formatWaitMinutes, isOverGoal, waitBusinessMinutes } from './inboxGoal';
import { useGoalConfig, useInboxSettings } from './useInboxSettings';
import { BulkAssignDialog, BulkCloseDialog, BulkLabelDialog } from './BulkDialogs';
import { topSkipReason } from './bulkAssign';
import CloseDialog from './CloseDialog';
import FilterPopover from './FilterPopover';
import InboxToast, { type ToastData } from './InboxToast';
import SavedViewDialog from './SavedViewDialog';
import ContactPanel from './ContactPanel';
import InboxButton from './InboxButton';
import InboxDialog from './InboxDialog';
import InboxList from './InboxList';
import InboxMobileNav from './InboxMobileNav';
import InboxRail, { railScope } from './InboxRail';
import InboxSettings from './InboxSettings';
import InboxThread, { eventText } from './InboxThread';
import type { LabelPickerData } from './LabelPicker';
import SnoozeDialog from './SnoozeDialog';
import TransferDialog from './TransferDialog';
import { getChannelMeta } from './channelMeta';
import { EMPTY_FILTERS, activeFilterCount, contactName, inboxHref, readFilters, validTimeZone } from './inboxFormat';
import {
  DETAILS_FIXED_QUERY,
  MOBILE_QUERY,
  WIDE_QUERY,
  useConnection,
  useDetailsPreference,
  useMediaQuery,
  useNow,
} from './useInboxEnv';
import { useInboxCounts, useInboxList, type RowPatch } from './useInboxList';
import { normalizeIncoming, useConversationThread } from './useConversationThread';
import { useInboxLabels } from './useInboxLabels';
import { useQuickReplies } from './useQuickReplies';
import { useSavedViews } from './useSavedViews';
import type { BulkResult, CloseOutcome, InboxFilters, InboxView, LabelRef, SavedView, SavedViewFilters } from './types';
import listStyles from './InboxList.module.css';
import styles from './InboxScreen.module.css';

type PlanKey = keyof typeof PLAN_LIMITS;
type NotificationPayload = Parameters<WebSocketEvents['notification:new']>[0];

const SHORTCUTS: Array<[keys: string, key: string]> = [
  ['J / K', 'next'],
  ['T', 'take'],
  ['E', 'close'],
  ['U', 'unread'],
  ['/', 'search'],
  ['Esc', 'escape'],
  ['?', 'help'],
];

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

/** La Bandeja (web-41): riel, lista, hilo y ficha. La monta el layout de /dashboard/conversations. */
export default function InboxScreen() {
  const router = useRouter();
  const params = useParams<{ id?: string }>();
  const pathname = usePathname();
  // Ajustes de la bandeja (web-43): misma pantalla, con el riel y sin lista ni hilo
  const settingsOpen = pathname === '/dashboard/conversations/settings';
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { t, language } = useTranslation();
  const { on, off, joinConversation, leaveConversation } = useWebSocket();

  const conversationId = typeof params.id === 'string' ? params.id : null;
  const query = searchParams.toString();
  const filters = useMemo(() => readFilters(new URLSearchParams(query)), [query]);
  const wide = useMediaQuery(WIDE_QUERY, true);
  const mobile = useMediaQuery(MOBILE_QUERY, false);
  const detailsFixed = useMediaQuery(DETAILS_FIXED_QUERY, true);
  const now = useNow();

  // ── búsqueda (con una pausa corta para no pedir con cada tecla) ──
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  // web-44: con menos de 2 letras no se busca (la lista sigue como si no hubiera búsqueda)
  const activeSearch = [...search].length >= INBOX_LIMITS.searchMinChars ? search : '';
  const searching = !!activeSearch;

  // ── vistas guardadas (web-44): personales ──
  const savedViews = useSavedViews(!!user);
  const activeView: SavedView | null = filters.savedView ? (savedViews.views?.find((v) => v.id === filters.savedView) ?? null) : null;

  // ── datos ──
  const me = useMemo(() => (user ? { id: user.id, name: user.name } : null), [user]);
  const list = useInboxList(filters, activeSearch, user?.id, activeView?.filters ?? null);
  const { counts, refresh: refreshRailCounts } = useInboxCounts(filters.allTime);
  // Los contadores de las vistas se refrescan con los mismos eventos que los del riel (agrupados)
  const viewsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reloadViews = savedViews.reload;
  const refreshCounts = useCallback(() => {
    refreshRailCounts();
    if (viewsTimer.current) clearTimeout(viewsTimer.current);
    viewsTimer.current = setTimeout(reloadViews, 800);
  }, [refreshRailCounts, reloadViews]);
  useEffect(
    () => () => {
      if (viewsTimer.current) clearTimeout(viewsTimer.current);
    },
    [],
  );
  const thread = useConversationThread(conversationId, me);
  const orgAgents = useOrgAgents(user?.orgId);
  const [plan, setPlan] = useState<string | null>(null);
  // Zona horaria de Ajustes (web-42): las horas de posponer y "hoy"; sin ella, la del navegador
  const [timeZone, setTimeZone] = useState<string | undefined>(undefined);
  const [activityKey, setActivityKey] = useState(0);
  const isManager = user?.role === 'owner' || user?.role === 'admin';
  // web-43: respuestas rápidas y catálogo de etiquetas de la organización
  const quick = useQuickReplies();
  const labelCatalog = useInboxLabels();
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [noteDeleting, setNoteDeleting] = useState(false);
  const noteCancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    api
      .get<{ plan?: string; settings?: { timezone?: unknown } }>('/api/organization')
      .then((org) => {
        setPlan(org.plan ?? 'solo');
        setTimeZone(validTimeZone(org.settings?.timezone));
      })
      .catch(() => setPlan(null));
  }, []);
  const limits = plan ? PLAN_LIMITS[plan as PlanKey] : undefined;
  const canTakeover = limits ? limits.humanTakeover : null;

  // ── web-45: la meta (Ajustes de la bandeja), la pausa de cada agente y la presencia ──
  const inboxSettings = useInboxSettings(!!user);
  const goal = useGoalConfig(inboxSettings.data, timeZone);
  const onlineCount = inboxSettings.data ? inboxSettings.data.team.filter((m) => m.online).length : null;
  const [pauses, setPauses] = useState<Record<string, AgentPause>>({});
  useEffect(() => {
    if (!user?.orgId) return;
    api
      .get<{ agents: Array<{ id: string; inboxPausedAt?: string | null; inboxPausedByName?: string | null }> }>('/api/agents?limit=100')
      .then((r) =>
        setPauses(
          Object.fromEntries(r.agents.map((a) => [a.id, { pausedAt: a.inboxPausedAt ?? null, pausedByName: a.inboxPausedByName ?? null }])),
        ),
      )
      .catch(() => {
        /* sin el dato, ningún agente se ve pausado */
      });
  }, [user?.orgId]);
  useEffect(() => {
    const onAgent: WebSocketEvents['agent:update'] = (d) =>
      setPauses((prev) => ({ ...prev, [d.agentId]: { pausedAt: d.inboxPausedAt, pausedByName: d.inboxPausedByName } }));
    on('agent:update', onAgent);
    return () => off('agent:update', onAgent);
  }, [on, off]);
  const pausedAgentIds = useMemo(
    () => new Set(Object.entries(pauses).filter(([, p]) => !!p.pausedAt).map(([id]) => id)),
    [pauses],
  );

  // ── capas abiertas ──
  // El cajón solo existe bajo 1180 px: al ensanchar la ventana deja de estar abierto
  const [railWanted, setRailOpen] = useState(false);
  const railOpen = railWanted && !wide;
  // La ficha: columna fija desde 1600 px; entre 768 y 1600, panel sobre el hilo (recordado);
  // bajo 768, hoja con fondo que se cierra al cambiar de conversación
  const [contactWanted, setContactOpen] = useState(false);
  const contactOpen = contactWanted && mobile;
  const [detailsPref, setDetailsPref] = useDetailsPreference();
  const detailsOpen = detailsPref && !detailsFixed && !mobile && !!conversationId;
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const pushedRef = useRef(false);

  // ── navegación ──
  const go = useCallback(
    (nextFilters: InboxFilters, id: string | null, mode: 'push' | 'replace' = 'replace') => {
      router[mode](inboxHref(nextFilters, id), { scroll: false });
    },
    [router],
  );

  const selectFilters = useCallback(
    (patch: Partial<InboxFilters>) => {
      const next = { ...filters, ...patch };
      // Una vista guardada fija su estado y su periodo: el resultado de "Cerradas" y el orden no aplican
      if (next.savedView) next.outcome = null;
      setRailOpen(false);
      // En móvil, elegir una vista vuelve a la lista
      go(next, mobile ? null : conversationId);
    },
    [filters, go, mobile, conversationId],
  );

  const openConversation = useCallback(
    (id: string) => {
      if (id === conversationId) return;
      setContactOpen(false);
      // En móvil el hilo se abre "encima" de la lista: Atrás vuelve a ella
      if (mobile) {
        pushedRef.current = true;
        go(filters, id, 'push');
      } else {
        go(filters, id);
      }
    },
    [conversationId, filters, go, mobile],
  );

  const backToList = useCallback(() => {
    if (pushedRef.current) {
      pushedRef.current = false;
      router.back();
    } else {
      go(filters, null);
    }
  }, [filters, go, router]);

  // ── sala de la conversación abierta ──
  useEffect(() => {
    if (!conversationId) return;
    joinConversation(conversationId);
    return () => leaveConversation(conversationId);
  }, [conversationId, joinConversation, leaveConversation]);

  // ── tiempo real ──
  const reloadLabels = labelCatalog.reload;
  const readBlockedRef = useRef<string | null>(null);
  const lastReadAt = useRef(0);
  const live = useRef({ list, thread, conversationId, refreshCounts, t, userId: user?.id, isManager, reloadLabels, orgId: user?.orgId, reloadViews });
  useLayoutEffect(() => {
    live.current = { list, thread, conversationId, refreshCounts, t, userId: user?.id, isManager, reloadLabels, orgId: user?.orgId, reloadViews };
  });

  // ── leído / no leído (web-44): por persona ──
  const markRead = useCallback((id: string) => {
    lastReadAt.current = Date.now();
    live.current.list.setUnread(id, false);
    api.post(`/api/conversations/${id}/read`).catch(() => {
      /* la próxima apertura lo vuelve a intentar */
    });
  }, []);

  // Abrir una conversación la marca leída al instante (salvo que se acabe de marcar como no leída)
  useEffect(() => {
    if (!conversationId) return;
    if (readBlockedRef.current !== conversationId) readBlockedRef.current = null;
    if (readBlockedRef.current) return;
    markRead(conversationId);
  }, [conversationId, markRead]);

  // Al volver a la pestaña, la abierta que recibió mensajes se marca leída
  useEffect(() => {
    const onVisible = () => {
      const { conversationId: openId, list: l } = live.current;
      if (document.visibilityState !== 'visible' || !openId || readBlockedRef.current === openId) return;
      if (l.rows.find((r) => r.id === openId)?.unread) markRead(openId);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [markRead]);

  useEffect(() => {
    const nameOf = (id: string): string => {
      const { list: l, thread: th, t: tr } = live.current;
      const row = l.rows.find((r) => r.id === id);
      const contact = row?.contact ?? (th.conversation?.id === id ? th.conversation.contact : null);
      return contactName(contact ?? null, tr('inbox.row.unknownContact'));
    };

    const handleMessage: WebSocketEvents['message:new'] = (data) => {
      const msgs = normalizeIncoming(data);
      const last = msgs[msgs.length - 1];
      if (!last) return;
      const { list: l, thread: th, conversationId: openId, refreshCounts: rc, t: tr } = live.current;
      // web-44: un mensaje del cliente la deja sin leer, salvo la abierta con la pestaña visible
      const fromCustomer = msgs.some((m) => m.role === 'user');
      const watching =
        data.conversationId === openId && document.visibilityState === 'visible' && readBlockedRef.current !== openId;
      if (fromCustomer && watching && Date.now() - lastReadAt.current > 4000) markRead(data.conversationId);
      l.patch({
        conversationId: data.conversationId,
        ...(fromCustomer ? { unread: !watching } : {}),
        message: {
          role: last.role,
          content: last.content,
          createdAt: last.createdAt,
          sentByName: last.metadata.sentBy?.name ?? null,
          sentById: last.metadata.sentBy?.id ?? null,
        },
      });
      rc();
      if (data.conversationId === openId) th.addMessages(msgs);
      if (msgs.some((m) => m.role === 'user')) {
        setAnnouncement(tr('inbox.live.newMessage', { name: nameOf(data.conversationId) }));
      }
    };

    const handleUpdate: WebSocketEvents['conversation:update'] = (data) => {
      const { list: l, thread: th, conversationId: openId, refreshCounts: rc } = live.current;
      const status = data.status === 'closed' || data.status === 'active' || data.status === 'human_takeover' ? data.status : undefined;
      // Solo los campos que vinieron (web-42): posponer, cierre con resultado y quién la tiene
      const fields: NonNullable<RowPatch['fields']> = {};
      if (data.snoozedUntil !== undefined) fields.snoozedUntil = data.snoozedUntil;
      if (data.snoozedBy !== undefined) fields.snoozedBy = data.snoozedBy;
      if (data.followUpAt !== undefined) fields.followUpAt = data.followUpAt;
      if (data.closedOutcome !== undefined) fields.closedOutcome = data.closedOutcome;
      if (data.closedAt !== undefined) fields.closedAt = data.closedAt;
      if (data.closedBy !== undefined) fields.closedBy = data.closedBy;
      if (data.closedByName !== undefined) fields.closedByName = data.closedByName;
      if (data.labels !== undefined) fields.labels = data.labels;
      // web-45: un pedido de ayuda nuevo (p. ej. el agente está pausado) entra a "Necesitan"
      if (data.handoffActive && data.handedOffAt) {
        l.patch({ conversationId: data.conversationId, handoffAt: data.handedOffAt });
        if (data.conversationId === openId) th.applyHandoff(data.handedOffAt);
      }
      const changed = !!status || Object.keys(fields).length > 0 || data.takenOverBy !== undefined;
      if (!changed) {
        if (data.handoffActive) rc();
        return;
      }
      l.patch({
        conversationId: data.conversationId,
        status,
        ...(data.takenOverBy !== undefined ? { takenOverBy: data.takenOverBy } : {}),
        ...(data.takeoverUserName !== undefined ? { takeoverUserName: data.takeoverUserName } : {}),
        fields,
      });
      if (data.conversationId === openId) th.applyChange(data);
      rc();
    };

    const handleTakeover: WebSocketEvents['takeover:status'] = (data) => {
      const { list: l, thread: th, conversationId: openId, refreshCounts: rc } = live.current;
      const name = data.userDisplayName ?? data.userName ?? null;
      const taken = data.status === 'human_takeover';
      l.patch({
        conversationId: data.conversationId,
        status: taken ? 'human_takeover' : 'active',
        takenOverBy: taken ? data.userId : null,
        takeoverUserName: taken ? name : null,
      });
      if (data.conversationId === openId) th.applyTakeover(data.status, data.userId, name, data.takenOverAt ?? new Date().toISOString());
      rc();
    };

    const handleNotification = (data: NotificationPayload) => {
      if (data.type !== 'human_handoff') return;
      const id = data.data?.['conversationId'];
      if (typeof id !== 'string') return;
      const { list: l, thread: th, conversationId: openId, refreshCounts: rc, t: tr } = live.current;
      l.patch({ conversationId: id, handoffAt: data.createdAt });
      if (id === openId) th.applyHandoff(data.createdAt);
      rc();
      setAnnouncement(tr('inbox.live.handoff', { name: nameOf(id) }));
    };

    const handleVariables: WebSocketEvents['variables:update'] = (data) => {
      const { thread: th, conversationId: openId } = live.current;
      if (data.conversationId === openId) th.patchConversation((c) => ({ ...c, capturedVariables: data.variables }));
    };

    const handleScored: WebSocketEvents['contact:scored'] = (data) => {
      const { list: l, thread: th, conversationId: openId } = live.current;
      l.patch({ conversationId: data.conversationId, aiScore: data.score });
      const open = th.conversation;
      if (open && (data.conversationId === openId || (data.contactId && open.contact?.id === data.contactId))) {
        th.patchConversation((c) => ({
          ...c,
          aiScore: data.conversationId === c.id ? data.score : c.aiScore,
          contact: c.contact
            ? {
                ...c.contact,
                aiScore: data.score,
                aiService: data.service || c.contact.aiService,
                funnelStage: data.funnelStage ?? c.contact.funnelStage,
              }
            : c.contact,
        }));
        setActivityKey((k) => k + 1);
      }
    };

    // Notas internas (web-43): canDelete depende de quien mira, así que se recalcula aquí
    const handleNote: WebSocketEvents['conversation:note'] = (data) => {
      const { thread: th, userId, isManager: manager } = live.current;
      const canDelete = (!!userId && data.note.authorUserId === userId) || manager;
      th.addNote(data.conversationId, { ...data.note, canDelete });
    };
    const handleNoteDeleted: WebSocketEvents['conversation:note-deleted'] = (data) => {
      live.current.thread.dropNote(data.conversationId, data.noteId, data.event ?? null);
    };
    // Se renombró o borró una etiqueta: el catálogo se recarga y las filas y la ficha cambian
    const handleLabels: WebSocketEvents['inbox-labels:changed'] = (data) => {
      const { list: l, thread: th, reloadLabels: rl } = live.current;
      rl();
      const fix = (labels: LabelRef[]): LabelRef[] =>
        data.action === 'deleted'
          ? labels.filter((x) => x.id !== data.labelId)
          : labels
              .map((x) => (x.id === data.label.id ? { ...x, name: data.label.name } : x))
              .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
      l.mapLabels(fix);
      th.patchConversation((c) => (c.labels ? { ...c, labels: fix(c.labels) } : c));
    };

    const handleReadState: WebSocketEvents['conversation:read-state'] = (data) => {
      const { list: l, orgId } = live.current;
      if (orgId && data.organizationId !== orgId) return;
      l.setUnread(data.conversationId, data.unread);
    };
    const handleViews: WebSocketEvents['inbox-views:changed'] = (data) => {
      const { orgId, reloadViews: rv } = live.current;
      if (!orgId || data.organizationId === orgId) rv();
    };

    on('conversation:read-state', handleReadState);
    on('inbox-views:changed', handleViews);
    on('message:new', handleMessage);
    on('conversation:note', handleNote);
    on('conversation:note-deleted', handleNoteDeleted);
    on('inbox-labels:changed', handleLabels);
    on('conversation:update', handleUpdate);
    on('takeover:status', handleTakeover);
    on('notification:new', handleNotification);
    on('variables:update', handleVariables);
    on('contact:scored', handleScored);
    return () => {
      off('conversation:read-state', handleReadState);
      off('inbox-views:changed', handleViews);
      off('message:new', handleMessage);
      off('conversation:note', handleNote);
      off('conversation:note-deleted', handleNoteDeleted);
      off('inbox-labels:changed', handleLabels);
      off('conversation:update', handleUpdate);
      off('takeover:status', handleTakeover);
      off('notification:new', handleNotification);
      off('variables:update', handleVariables);
      off('contact:scored', handleScored);
    };
  }, [on, off, markRead]);

  // Al volver la conexión se recarga lo que se pudo perder
  const { online } = useConnection(() => {
    const { list: l, thread: th, refreshCounts: rc } = live.current;
    l.reload();
    rc();
    th.reload({ quiet: true });
  });

  // ── acciones del hilo ──
  const c = thread.conversation;
  const takenByMe = !!c && c.status === 'human_takeover' && c.takenOverBy === user?.id;

  // Al tomarla, el foco va al cuadro para responder
  const wasMine = useRef(false);
  useEffect(() => {
    if (takenByMe && !wasMine.current) requestAnimationFrame(() => textareaRef.current?.focus());
    wasMine.current = takenByMe;
  }, [takenByMe, c?.id]);

  // Tras una acción propia la fila y los contadores cambian al instante (el eco por WebSocket llega igual)
  const take = useCallback(async () => {
    const id = thread.conversation?.id;
    if (id && me && (await thread.take())) {
      list.patch({ conversationId: id, status: 'human_takeover', takenOverBy: me.id, takeoverUserName: me.name, fields: { snoozedUntil: null } });
      refreshCounts();
    }
  }, [thread, me, list, refreshCounts]);

  // Devolver al agente: quien la tiene usa "release"; el owner/admin, la de otra persona, "transfer" a nadie
  const release = useCallback(async () => {
    const conv = thread.conversation;
    if (!conv) return;
    const ok = conv.takenOverBy === me?.id ? await thread.release() : await thread.transfer(null, null, '');
    if (ok) {
      list.patch({ conversationId: conv.id, status: 'active', takenOverBy: null, takeoverUserName: null });
      refreshCounts();
    }
  }, [thread, me, list, refreshCounts]);

  const doTransfer = async (toUserId: string | null, toName: string | null, note: string) => {
    const id = thread.conversation?.id;
    const ok = await thread.transfer(toUserId, toName, note);
    setTransferOpen(false);
    if (ok && id) {
      list.patch(
        toUserId
          ? { conversationId: id, status: 'human_takeover', takenOverBy: toUserId, takeoverUserName: toName, fields: { snoozedUntil: null } }
          : { conversationId: id, status: 'active', takenOverBy: null, takeoverUserName: null },
      );
      refreshCounts();
      setAnnouncement(toUserId ? t('inbox.live.transferred', { name: toName ?? '' }) : t('inbox.live.released'));
    }
  };

  // "Tomarla tú" (owner/admin): la de otra persona pasa a ser tuya
  const takeOver = useCallback(async () => {
    const id = thread.conversation?.id;
    if (id && me && (await thread.transfer(me.id, me.name, ''))) {
      list.patch({ conversationId: id, status: 'human_takeover', takenOverBy: me.id, takeoverUserName: me.name, fields: { snoozedUntil: null } });
      refreshCounts();
    }
  }, [thread, me, list, refreshCounts]);

  const doSnooze = async (until: Date) => {
    const id = thread.conversation?.id;
    const ok = await thread.snooze(until);
    setSnoozeOpen(false);
    if (ok && id) {
      list.patch({ conversationId: id, fields: { snoozedUntil: until.toISOString(), snoozedBy: me?.id ?? null, followUpAt: null } });
      refreshCounts();
      setAnnouncement(t('inbox.live.snoozed'));
    }
  };

  const unsnooze = useCallback(async () => {
    const id = thread.conversation?.id;
    if (id && (await thread.unsnooze())) {
      list.patch({ conversationId: id, fields: { snoozedUntil: null } });
      refreshCounts();
    }
  }, [thread, list, refreshCounts]);

  const reopen = useCallback(async () => {
    const id = thread.conversation?.id;
    if (id && (await thread.reopen())) {
      list.patch({
        conversationId: id,
        status: 'active',
        takenOverBy: null,
        takeoverUserName: null,
        fields: { closedOutcome: null, closedAt: null, closedBy: null, closedByName: null },
      });
      refreshCounts();
      setAnnouncement(t('inbox.live.reopened'));
    }
  }, [thread, list, refreshCounts, t]);

  const askClose = useCallback(() => {
    if (c && c.status !== 'closed') setConfirmClose(true);
  }, [c]);

  const doClose = async (outcome: CloseOutcome) => {
    const id = thread.conversation?.id;
    const ok = await thread.close(outcome);
    setConfirmClose(false);
    if (ok && id) {
      list.patch({
        conversationId: id,
        status: 'closed',
        fields: { closedOutcome: outcome, closedAt: new Date().toISOString(), closedBy: me?.id ?? null, closedByName: me?.name ?? null, snoozedUntil: null },
      });
      refreshCounts();
    }
  };

  // ── notas y etiquetas (web-43) ──
  const doDeleteNote = async () => {
    if (!noteToDelete) return;
    setNoteDeleting(true);
    await thread.deleteNote(noteToDelete);
    setNoteDeleting(false);
    setNoteToDelete(null);
    setAnnouncement(t('inbox.live.noteDeleted'));
  };

  const changeLabels = useCallback(
    async (next: LabelRef[]) => {
      const conv = thread.conversation;
      if (!conv) return;
      const before = conv.labels ?? [];
      const sorted = [...next].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
      list.patch({ conversationId: conv.id, fields: { labels: sorted } });
      const ok = await thread.setLabels(sorted);
      if (!ok) list.patch({ conversationId: conv.id, fields: { labels: before } });
    },
    [thread, list],
  );

  const noteActivity = useMemo(
    () =>
      thread.events
        .filter((e) => e.kind === 'note_deleted')
        .map((e) => ({ id: e.id, at: e.at, text: eventText(e, user?.id, t, language) })),
    [thread.events, user?.id, t, language],
  );

  const labelPicker: LabelPickerData = {
    catalog: labelCatalog.labels,
    selected: c?.labels ?? [],
    onChange: (next) => void changeLabels(next),
    canCreate: isManager,
    onCreate: labelCatalog.create,
  };

  // ── atajos de teclado ──
  const visibleIds = useMemo(() => list.rows.map((r) => r.id), [list.rows]);

  // Borrar: la lista y los contadores se actualizan y se abre la siguiente (o el estado vacío)
  const doDelete = async () => {
    const id = thread.conversation?.id;
    if (!id) return;
    const index = visibleIds.indexOf(id);
    const rest = visibleIds.filter((v) => v !== id);
    const nextId = mobile || !rest.length ? null : (rest[Math.min(Math.max(index, 0), rest.length - 1)] ?? null);
    const ok = await thread.remove();
    setConfirmDelete(false);
    if (!ok) return;
    list.remove(id);
    refreshCounts();
    setAnnouncement(t('inbox.live.deleted'));
    pushedRef.current = false;
    go(filters, nextId);
  };
  // ── avisos (web-44) ──
  const [toast, setToast] = useState<ToastData | null>(null);
  const showToast = useCallback((text: string, action?: ToastData['action']) => {
    setToast({ id: Date.now(), text, action });
  }, []);

  // ── marcar como no leída (web-44): el hilo sigue abierto y no se vuelve a marcar leída mientras siga así ──
  const markUnread = useCallback(() => {
    const id = thread.conversation?.id;
    if (!id) return;
    readBlockedRef.current = id;
    list.setUnread(id, true);
    api.post(`/api/conversations/${id}/unread`).catch(() => {
      list.setUnread(id, false);
    });
    showToast(t('inbox.unread.marked'), {
      label: t('inbox.unread.undo'),
      run: () => {
        readBlockedRef.current = null;
        markRead(id);
      },
    });
  }, [thread.conversation?.id, list, showToast, t, markRead]);

  // ── selección y lote (web-44) ──
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [bulkDialog, setBulkDialog] = useState<'assign' | 'close' | 'label' | 'delete' | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const exitSelection = useCallback(() => {
    setSelecting(false);
    setSelected(new Set());
    setBulkDialog(null);
  }, []);
  // Cambiar de vista, de filtro o buscar sale de la selección
  const selectionKey = `${query}#${activeSearch}`;
  const [lastSelectionKey, setLastSelectionKey] = useState(selectionKey);
  if (lastSelectionKey !== selectionKey) {
    setLastSelectionKey(selectionKey);
    if (selecting || selected.size) {
      setSelecting(false);
      setSelected(new Set());
      setBulkDialog(null);
    }
  }
  const toggleRow = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < INBOX_LIMITS.bulkMax) next.add(id);
      return next;
    });
  }, []);
  const selectLoaded = useCallback(() => {
    setSelected(new Set(list.rows.slice(0, INBOX_LIMITS.bulkMax).map((r) => r.id)));
  }, [list.rows]);
  const startSelectionWith = useCallback((id: string) => {
    setSelecting(true);
    setSelected(new Set([id]));
  }, []);
  const selectedRows = useMemo(() => list.rows.filter((r) => selected.has(r.id)), [list.rows, selected]);

  const finishBulk = (result: BulkResult) => {
    const u = result.updated.length;
    const k = result.skipped.length;
    if (k === 0) showToast(t('inbox.bulk.doneAll', { count: u }));
    else {
      const reason = topSkipReason(result.skipped);
      const head = t('inbox.bulk.donePartial', { updated: t('inbox.bulk.updatedN', { count: u }), skipped: t('inbox.bulk.skippedN', { count: k }) });
      showToast(reason ? `${head} ${t(`inbox.bulk.reasons.${reason}`)}` : head);
    }
    exitSelection();
    list.reload();
    refreshCounts();
  };

  const runBulk = async (path: string, body: Record<string, unknown>) => {
    setBulkBusy(true);
    try {
      const result = await api.post<BulkResult>(path, { ids: [...selected], ...body });
      finishBulk(result);
    } catch {
      showToast(t('inbox.bulk.failed'));
      setBulkDialog(null);
    } finally {
      setBulkBusy(false);
    }
  };

  const bulkDelete = async () => {
    setBulkBusy(true);
    try {
      const ids = [...selected];
      const r = await api.delete<{ deleted: number }>('/api/conversations/bulk', { conversationIds: ids });
      showToast(t('inbox.bulk.deleted', { count: r.deleted }));
      if (conversationId && ids.includes(conversationId)) go(filters, null);
      exitSelection();
      list.reload();
      refreshCounts();
    } catch {
      showToast(t('inbox.bulk.failed'));
      setBulkDialog(null);
    } finally {
      setBulkBusy(false);
    }
  };

  // ── filtros y vistas guardadas (web-44) ──
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersBtnRef = useRef<HTMLButtonElement>(null);
  const [viewDialog, setViewDialog] = useState<{ view: SavedView | null; initial?: SavedViewFilters } | null>(null);

  // Una vista que no existe (borrada o de otra persona) vuelve a Todas sin error
  useEffect(() => {
    if (filters.savedView && savedViews.views && !activeView) {
      go({ ...filters, savedView: null, view: 'all' }, conversationId);
    }
  }, [filters, savedViews.views, activeView, go, conversationId]);

  const openView = useCallback(
    (id: string) => {
      setRailOpen(false);
      go({ ...EMPTY_FILTERS, savedView: id }, mobile ? null : conversationId);
    },
    [go, mobile, conversationId],
  );

  const panelFilters: SavedViewFilters = {
    ...(filters.channels.length ? { channels: filters.channels } : {}),
    ...(filters.agentIds.length ? { agentIds: filters.agentIds } : {}),
    ...(filters.labelIds.length ? { labelIds: filters.labelIds } : {}),
    ...(filters.minScore ? { minScore: filters.minScore } : {}),
    state: filters.view === 'needs' ? 'needs' : filters.view === 'mine' ? 'mine' : filters.view === 'closed' ? 'closed' : 'open',
    allTime: filters.allTime,
  };

  const saveView = async (name: string, f: SavedViewFilters): Promise<'ok' | 'taken' | 'error'> => {
    try {
      const editing = viewDialog?.view;
      const view = editing ? await savedViews.update(editing.id, name, f) : await savedViews.create(name, f);
      setViewDialog(null);
      showToast(t('inbox.views.savedToast'));
      go({ ...EMPTY_FILTERS, savedView: view.id }, conversationId);
      return 'ok';
    } catch (err) {
      return (err as { code?: string }).code === 'view_name_taken' ? 'taken' : 'error';
    }
  };

  const deleteView = async (): Promise<boolean> => {
    const v = viewDialog?.view;
    if (!v) return false;
    try {
      await savedViews.remove(v.id);
      setViewDialog(null);
      if (filters.savedView === v.id) go({ ...EMPTY_FILTERS }, conversationId);
      return true;
    } catch {
      return false;
    }
  };

  const selectingRef = useRef(selecting);
  useLayoutEffect(() => {
    selectingRef.current = selecting;
  });
  const keys = useRef({ visibleIds, conversationId, c, canTakeover, askClose, openConversation, take, markUnread });
  useLayoutEffect(() => {
    keys.current = { visibleIds, conversationId, c, canTakeover, askClose, openConversation, take, markUnread };
  });
  const layersOpen =
    railOpen ||
    contactOpen ||
    confirmClose ||
    confirmDelete ||
    helpOpen ||
    transferOpen ||
    snoozeOpen ||
    !!noteToDelete ||
    filtersOpen ||
    !!viewDialog ||
    !!bulkDialog;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape') {
        if (layersOpen && !railOpen && !contactOpen) return;
        if (railOpen) setRailOpen(false);
        else if (selectingRef.current) exitSelection();
        else if (contactOpen) setContactOpen(false);
        else if (detailsOpen) setDetailsPref(false);
        return;
      }
      if (isTyping(e.target) || layersOpen) return;
      const k = keys.current;
      const key = e.key;
      if (key === 'j' || key === 'k' || key === 'J' || key === 'K') {
        if (!k.visibleIds.length) return;
        e.preventDefault();
        const index = k.conversationId ? k.visibleIds.indexOf(k.conversationId) : -1;
        const nextIndex = key.toLowerCase() === 'j' ? Math.min(k.visibleIds.length - 1, index + 1) : Math.max(0, index - 1);
        const id = k.visibleIds[nextIndex];
        if (id) {
          k.openConversation(id);
          requestAnimationFrame(() =>
            document.querySelector<HTMLElement>(`[data-conversation-id="${id}"]`)?.scrollIntoView({ block: 'nearest' }),
          );
        }
      } else if (key === 't' || key === 'T') {
        if (k.c && k.c.status !== 'closed' && !k.c.takenOverBy && k.canTakeover) {
          e.preventDefault();
          void k.take();
        }
      } else if (key === 'e' || key === 'E') {
        if (k.c && k.c.status !== 'closed') {
          e.preventDefault();
          k.askClose();
        }
      } else if (key === 'u' || key === 'U') {
        if (k.c) {
          e.preventDefault();
          k.markUnread();
        }
      } else if (key === '/') {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (key === '?') {
        e.preventDefault();
        setHelpOpen(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [railOpen, contactOpen, layersOpen, detailsOpen, setDetailsPref, exitSelection]);

  // Foco en los cajones al abrirlos
  useEffect(() => {
    if (railOpen) drawerRef.current?.querySelector<HTMLElement>('button')?.focus();
  }, [railOpen]);
  useEffect(() => {
    if (contactOpen) sheetRef.current?.querySelector<HTMLElement>('button')?.focus();
  }, [contactOpen]);

  // ── títulos ──
  const scope = railScope(filters);
  const agentNameOf = (id: string) =>
    orgAgents?.agents.find((a) => a.id === id)?.name ?? counts?.byAgent.find((a) => a.agentId === id)?.agentName ?? null;
  const title = searching
    ? t('inbox.list.results')
    : filters.savedView
      ? (activeView?.name ?? '')
      : scope.agentId
        ? agentNameOf(scope.agentId) || t('inbox.rail.unnamedAgent')
        : scope.channel
          ? getChannelMeta(scope.channel).label
          : t(`inbox.views.${filters.view}`);
  const scoped = !!(scope.agentId || scope.channel || filters.savedView);
  const showPeriod = !filters.savedView && (filters.view === 'all' || filters.view === 'closed');
  const showOrder = !filters.savedView && filters.view === 'all';
  const agents = useMemo(() => (orgAgents?.agents ?? []).map((a) => ({ id: a.id, name: a.name })), [orgAgents]);

  // ── opciones de los filtros y chips (web-44) ──
  const channelOptions = useMemo(() => {
    const keys = [...new Set([...(counts?.byChannel ?? []).map((c) => c.channel), ...filters.channels])];
    return keys.map((ch) => ({ value: ch, label: getChannelMeta(ch).label, dot: getChannelMeta(ch).color }));
  }, [counts, filters.channels]);
  const agentOptions = useMemo(() => agents.map((a) => ({ value: a.id, label: a.name })), [agents]);
  const labelOptions = useMemo(() => (labelCatalog.labels ?? []).map((l) => ({ value: l.id, label: l.name })), [labelCatalog.labels]);
  const labelName = (id: string) => labelCatalog.labels?.find((l) => l.id === id)?.name ?? t('inbox.filters.unknownLabel');
  const filterCount = activeFilterCount(filters);

  const removeChip = (patch: Partial<InboxFilters>) => selectFilters(patch);
  const chip = (key: string, text: string, onRemove?: () => void) => (
    <span key={key} className={`${listStyles.chip} ${onRemove ? '' : listStyles.chipStatic}`}>
      <span className={listStyles.chipText} title={text}>
        {text}
      </span>
      {onRemove && (
        <button type="button" className={listStyles.chipX} onClick={onRemove} aria-label={t('inbox.filters.remove', { name: text })}>
          <X size={12} aria-hidden="true" />
        </button>
      )}
    </span>
  );
  const viewCriteria: React.ReactNode[] = [];
  if (activeView) {
    const f = activeView.filters;
    for (const ch of f.channels ?? []) viewCriteria.push(chip(`v-ch-${ch}`, t('inbox.filters.chipChannel', { name: getChannelMeta(ch).label })));
    for (const id of f.agentIds ?? []) viewCriteria.push(chip(`v-ag-${id}`, t('inbox.filters.chipAgent', { name: agentNameOf(id) ?? '…' })));
    for (const id of f.labelIds ?? []) viewCriteria.push(chip(`v-lb-${id}`, t('inbox.filters.chipLabel', { name: labelName(id) })));
    if (f.minScore) viewCriteria.push(chip('v-score', t('inbox.views.scoreChip', { n: f.minScore })));
    viewCriteria.push(chip('v-state', t(`inbox.views.states.${f.state ?? 'open'}`)));
    viewCriteria.push(chip('v-period', f.allTime ? t('inbox.list.allTime') : t('inbox.list.last8days')));
  }
  const filterChips: React.ReactNode[] = [
    ...filters.channels.map((ch) =>
      chip(`ch-${ch}`, getChannelMeta(ch).label, () => removeChip({ channels: filters.channels.filter((x) => x !== ch) })),
    ),
    ...filters.agentIds.map((id) =>
      chip(`ag-${id}`, agentNameOf(id) || t('inbox.rail.unnamedAgent'), () => removeChip({ agentIds: filters.agentIds.filter((x) => x !== id) })),
    ),
    ...filters.labelIds.map((id) => chip(`lb-${id}`, labelName(id), () => removeChip({ labelIds: filters.labelIds.filter((x) => x !== id) }))),
    ...(filters.minScore ? [chip('score', t('inbox.filters.score7'), () => removeChip({ minScore: null }))] : []),
  ];
  const chips =
    viewCriteria.length || filterChips.length ? (
      <div className={listStyles.chips}>
        {viewCriteria}
        {activeView && (
          <button type="button" className={listStyles.chipAction} onClick={() => setViewDialog({ view: activeView })}>
            {t('inbox.views.edit')}
          </button>
        )}
        {filterChips}
        {filterChips.length > 0 && (
          <>
            <button type="button" className={listStyles.chipAction} onClick={() => removeChip({ channels: [], agentIds: [], labelIds: [], minScore: null })}>
              {t('inbox.filters.clear')}
            </button>
            {!activeView && (savedViews.views?.length ?? 0) < INBOX_LIMITS.savedViewsPerUser && (
              <button type="button" className={listStyles.chipAction} onClick={() => setViewDialog({ view: null, initial: panelFilters })}>
                {t('inbox.filters.saveAsView')}
              </button>
            )}
          </>
        )}
      </div>
    ) : null;

  const mobileSelecting = mobile && selecting;
  const headerActions = mobileSelecting ? (
    <InboxButton variant="icon" icon={X} onClick={exitSelection} aria-label={t('inbox.bulk.exit')} />
  ) : (
    <>
      <InboxButton
        variant="icon"
        icon={SquareCheck}
        onClick={() => (selecting ? exitSelection() : setSelecting(true))}
        aria-pressed={selecting}
        aria-label={t('inbox.bulk.selectMode')}
        title={t('inbox.bulk.selectMode')}
      />
      <span className={listStyles.popWrap}>
        <InboxButton
          ref={filtersBtnRef}
          variant="icon"
          icon={Filter}
          className={listStyles.headerBtn}
          onClick={() => setFiltersOpen((o) => !o)}
          aria-pressed={filterCount > 0}
          aria-expanded={filtersOpen}
          aria-controls={filtersOpen ? 'inbox-filters' : undefined}
          aria-label={filterCount ? t('inbox.filters.buttonCount', { count: filterCount }) : t('inbox.filters.title')}
          title={t('inbox.filters.title')}
        />
        {filterCount > 0 && (
          <span className={listStyles.filterCount} aria-hidden="true">
            {filterCount}
          </span>
        )}
        {filtersOpen && (
          <FilterPopover
            id="inbox-filters"
            filters={filters}
            channels={channelOptions}
            agents={agentOptions}
            labels={labelOptions}
            onChange={(patch) => selectFilters(patch)}
            onClose={() => setFiltersOpen(false)}
            anchorRef={filtersBtnRef}
          />
        )}
      </span>
    </>
  );
  const canAssign = canTakeover === true;
  const bulkBar =
    selecting && selected.size > 0 ? (
      <BulkBar
        count={selected.size}
        canAssign={canAssign}
        canDelete={isManager}
        onAssign={() => setBulkDialog('assign')}
        onClose={() => setBulkDialog('close')}
        onLabel={() => setBulkDialog('label')}
        onDelete={() => setBulkDialog('delete')}
        onExit={exitSelection}
        mobile={mobile}
      />
    ) : null;

  // ── web-45: avisos de la lista (la meta, el canal, la vista del agente) y del hilo ──
  const channelIssues = counts?.channelIssues ?? [];
  const scopedIssues = scope.channel && !filters.savedView ? channelIssues.filter((i) => i.channel === scope.channel) : [];
  const showGoal = !searching && !scoped && filters.view === 'needs';
  const showAgent = !searching && !!scope.agentId && !filters.savedView;
  const listNotices =
    showGoal || showAgent || (!searching && scopedIssues.length > 0) ? (
      <div className={styles.listNotices}>
        {showGoal && <InboxGoalBar oldestWaitingSince={counts?.oldestWaitingSince} goal={goal} now={now} />}
        {!searching &&
          scopedIssues.map((issue) => (
            <ChannelIssueNotice key={`${issue.agentId}-${issue.kind}`} issue={issue} isManager={isManager} timeZone={timeZone} now={now} />
          ))}
        {showAgent && scope.agentId && (
          <AgentStrip
            key={scope.agentId}
            agentId={scope.agentId}
            agentName={agentNameOf(scope.agentId) || t('inbox.rail.unnamedAgent')}
            pause={pauses[scope.agentId] ?? { pausedAt: null, pausedByName: null }}
            onPaused={(p) => setPauses((prev) => ({ ...prev, [scope.agentId!]: p }))}
            isManager={isManager}
            canPause={canTakeover !== false}
            onlineCount={onlineCount}
            openCount={counts?.byAgent.find((a) => a.agentId === scope.agentId)?.count ?? 0}
            timeZone={timeZone}
            now={now}
            refreshKey={counts}
          />
        )}
      </div>
    ) : null;

  const threadTopNotices = c ? (
    <>
      {c.status !== 'closed' && c.waitingSince && isOverGoal(c.waitingSince, goal, now) && goal && (
        <InboxNotice tone="bad" icon={Clock} slim>
          <b>{t('inbox.goal.threadWaiting', { time: formatWaitMinutes(waitBusinessMinutes(c.waitingSince, goal, now)) })}</b>{' '}
          {t('inbox.goal.threadGoal', { minutes: goal.goalMinutes })}
        </InboxNotice>
      )}
      {c.status !== 'closed' && pausedAgentIds.has(c.agentId) && (
        <InboxNotice tone="warn" icon={PauseCircle} slim>
          {t('inbox.pause.threadNotice')}
        </InboxNotice>
      )}
    </>
  ) : null;
  const threadIssue = c ? channelIssues.find((i) => i.kind === 'disconnected' && i.agentId === c.agentId && i.channel === c.channel) : undefined;
  const threadComposerNotices = threadIssue ? (
    <ChannelIssueNotice issue={threadIssue} isManager={isManager} timeZone={timeZone} now={now} slim />
  ) : null;

  const rail = (
    <InboxRail
      filters={filters}
      counts={counts}
      agents={agents}
      pausedAgentIds={pausedAgentIds}
      settingsOpen={settingsOpen}
      savedViews={savedViews.views}
      onOpenView={(id) => {
        if (settingsOpen) setRailOpen(false);
        if (settingsOpen) go({ ...EMPTY_FILTERS, savedView: id }, null);
        else openView(id);
      }}
      onNewView={() => {
        setRailOpen(false);
        // Desde Ajustes se vuelve a la Bandeja (el cuadro se dibuja allí; la pantalla no se desmonta)
        if (settingsOpen) go(filters, null);
        setViewDialog({ view: null });
      }}
      onSelect={(patch) => {
        // Desde Ajustes, elegir una vista vuelve a la Bandeja
        if (!settingsOpen) return selectFilters(patch);
        setRailOpen(false);
        go({ ...filters, ...patch }, null);
      }}
    />
  );
  const contactPanel = (
    <ContactPanel
      conversation={c}
      loading={thread.loading}
      now={now}
      activityKey={activityKey}
      notes={thread.notes}
      threadActivity={noteActivity}
      userId={user?.id}
      onSaveNote={thread.saveNote}
      onAskDeleteNote={setNoteToDelete}
      onRemoveLabel={(labelId) => void changeLabels((c?.labels ?? []).filter((l) => l.id !== labelId))}
      labelPicker={labelPicker}
      onClose={detailsFixed && !mobile ? undefined : mobile ? () => setContactOpen(false) : () => setDetailsPref(false)}
    />
  );

  const pane = mobile ? (conversationId ? 'thread' : 'list') : 'all';

  // Al ir a Ajustes (o volver) el cajón del riel se cierra
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setRailOpen(false);
  }

  if (settingsOpen) {
    return (
      <div className={styles.screen} data-pane="settings" data-open="no">
        <div className={`${styles.columns} ${styles.settingsColumns}`}>
          {wide && <div className={styles.railCol}>{rail}</div>}
          <div className={styles.settingsCol}>
            <InboxSettings
              isManager={isManager}
              userId={user?.id}
              inbox={inboxSettings}
              onOpenRail={wide ? undefined : () => setRailOpen(true)}
            />
          </div>
        </div>
        {!wide && railOpen && (
          <div
            className={styles.scrim}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setRailOpen(false);
            }}
          >
            <div
              ref={drawerRef}
              className={styles.drawer}
              role="dialog"
              aria-modal="true"
              aria-label={t('inbox.rail.label')}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setRailOpen(false);
                trapTab(e, drawerRef.current);
              }}
            >
              <div className={styles.drawerHead}>
                <span>{t('inbox.rail.inbox')}</span>
                <InboxButton variant="icon" icon={X} onClick={() => setRailOpen(false)} aria-label={t('inbox.rail.close')} />
              </div>
              {rail}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.screen} data-pane={pane} data-open={conversationId ? 'yes' : 'no'}>
      {!online && (
        <div className={styles.offline} role="status">
          <WifiOff size={14} aria-hidden="true" />
          {t('inbox.offline')}
        </div>
      )}

      <div className={styles.columns}>
        {wide && <div className={styles.railCol}>{rail}</div>}

        <div className={styles.listCol}>
          <InboxList
            title={mobileSelecting ? t('inbox.bulk.selected', { count: selected.size }) : title}
            headerActions={headerActions}
            chips={chips}
            searching={searching}
            onClearSearchAndFilters={() => {
              setSearchInput('');
              setSearch('');
              selectFilters({ channels: [], agentIds: [], labelIds: [], minScore: null });
            }}
            total={list.total}
            showOrder={showOrder}
            order={filters.order}
            onOrder={(order) => selectFilters({ order })}
            unreadCount={list.unreadCount}
            selecting={selecting}
            selectedIds={selected}
            onToggleRow={toggleRow}
            onSelectLoaded={selectLoaded}
            onLongPress={mobile ? startSelectionWith : undefined}
            bulkBar={mobile ? undefined : bulkBar}
            view={filters.view}
            scoped={scoped}
            allTime={filters.allTime}
            showPeriod={showPeriod}
            onPeriod={(allTime) => selectFilters({ allTime })}
            outcome={filters.outcome}
            onOutcome={(outcome) => selectFilters({ outcome })}
            timeZone={timeZone}
            search={searchInput}
            onSearch={setSearchInput}
            searchRef={searchRef}
            rows={list.rows}
            loading={list.loading}
            error={list.error}
            hasMore={list.hasMore}
            loadingMore={list.loadingMore}
            onLoadMore={list.loadMore}
            onRetry={list.reload}
            currentId={conversationId}
            onOpen={openConversation}
            userId={user?.id}
            now={now}
            onOpenRail={wide ? undefined : () => setRailOpen(true)}
            railOpen={railOpen}
            notices={listNotices}
            goal={goal}
          />
          {mobile &&
            (mobileSelecting && bulkBar ? (
              bulkBar
            ) : (
              <InboxMobileNav
                filters={filters}
                counts={counts}
                onSelect={(view: InboxView) => selectFilters({ view, savedView: null, agentIds: [], channels: [] })}
                onMore={() => setRailOpen(true)}
                moreOpen={railOpen}
              />
            ))}
        </div>

        <div className={styles.threadCol}>
          {conversationId ? (
            <InboxThread
              goalOver={!!c && c.status !== 'closed' && isOverGoal(c.waitingSince, goal, now)}
              agentPaused={!!c && pausedAgentIds.has(c.agentId)}
              topNotices={threadTopNotices}
              composerNotices={threadComposerNotices}
              thread={thread}
              userId={user?.id}
              canTakeover={canTakeover}
              canAttachImage={!!limits?.imageVision}
              canRecordVoice={!!limits?.voiceMessages}
              now={now}
              onAskClose={askClose}
              onTake={() => void take()}
              onRelease={() => void release()}
              isManager={isManager}
              timeZone={timeZone}
              onTakeOver={() => void takeOver()}
              onAskTransfer={() => setTransferOpen(true)}
              onAskSnooze={() => setSnoozeOpen(true)}
              onUnsnooze={() => void unsnooze()}
              onReopen={() => void reopen()}
              onAskDelete={isManager ? () => setConfirmDelete(true) : undefined}
              onBack={mobile ? backToList : undefined}
              onOpenContact={
                detailsFixed && !mobile
                  ? undefined
                  : mobile
                    ? () => setContactOpen(true)
                    : () => setDetailsPref(!detailsPref)
              }
              contactOpen={mobile ? contactOpen : detailsOpen}
              textareaRef={textareaRef}
              quickReplies={quick.replies}
              onUseReply={quick.markUsed}
              myName={user?.name ?? null}
              onAskDeleteNote={setNoteToDelete}
              labelPicker={labelPicker}
              onMarkUnread={markUnread}
            />
          ) : (
            <div className={styles.pick}>
              <InboxThread
                thread={thread}
                userId={user?.id}
                canTakeover={canTakeover}
                canAttachImage={false}
                canRecordVoice={false}
                now={now}
                onAskClose={askClose}
                onTake={() => void take()}
                onRelease={() => void release()}
                textareaRef={textareaRef}
              />
            </div>
          )}
          {detailsOpen && (
            <div id="inbox-details" className={styles.details}>
              {contactPanel}
            </div>
          )}
        </div>

        {detailsFixed && !mobile && conversationId && <div className={styles.contactCol}>{contactPanel}</div>}
      </div>

      {!wide && railOpen && (
        <div
          className={styles.scrim}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setRailOpen(false);
          }}
        >
          <div
            ref={drawerRef}
            className={styles.drawer}
            role="dialog"
            aria-modal="true"
            aria-label={t('inbox.rail.label')}
            onKeyDown={(e) => trapTab(e, drawerRef.current)}
          >
            <div className={styles.drawerHead}>
              <span>{t('inbox.rail.inbox')}</span>
              <InboxButton variant="icon" icon={X} onClick={() => setRailOpen(false)} aria-label={t('inbox.rail.close')} />
            </div>
            {rail}
          </div>
        </div>
      )}

      {contactOpen && conversationId && (
        <div
          className={styles.scrim}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setContactOpen(false);
          }}
        >
          <div
            ref={sheetRef}
            className={styles.sheet}
            role="dialog"
            aria-modal="true"
            aria-label={t('inbox.contact.title')}
            onKeyDown={(e) => trapTab(e, sheetRef.current)}
          >
            {contactPanel}
          </div>
        </div>
      )}

      {confirmClose && c && (
        <CloseDialog
          contactName={contactName(c.contact, t('inbox.row.unknownContact'))}
          busy={thread.busy === 'close'}
          onCancel={() => setConfirmClose(false)}
          onConfirm={(outcome) => void doClose(outcome)}
        />
      )}

      {transferOpen && c && (
        <TransferDialog
          contactName={contactName(c.contact, t('inbox.row.unknownContact'))}
          agentName={c.agentName}
          userId={user?.id}
          holderId={c.status === 'human_takeover' ? c.takenOverBy : null}
          canReturnToAgent={c.status === 'human_takeover'}
          busy={thread.busy === 'transfer'}
          onCancel={() => setTransferOpen(false)}
          onConfirm={(to, name, note) => void doTransfer(to, name, note)}
        />
      )}

      {snoozeOpen && c && (
        <SnoozeDialog
          timeZone={timeZone}
          busy={thread.busy === 'snooze'}
          onCancel={() => setSnoozeOpen(false)}
          onConfirm={(until) => void doSnooze(until)}
        />
      )}

      {confirmDelete && c && (
        <InboxDialog
          title={t('inbox.deleteDialog.title')}
          onClose={() => setConfirmDelete(false)}
          initialFocusRef={deleteRef}
          footer={
            <>
              <InboxButton ref={deleteRef} onClick={() => setConfirmDelete(false)}>
                {t('inbox.deleteDialog.cancel')}
              </InboxButton>
              <InboxButton variant="danger" icon={Trash2} onClick={() => void doDelete()} loading={thread.busy === 'delete'}>
                {t('inbox.deleteDialog.confirm')}
              </InboxButton>
            </>
          }
        >
          <p>{t('inbox.deleteDialog.text', { name: contactName(c.contact, t('inbox.row.unknownContact')) })}</p>
          {c.contact && <p>{t('inbox.deleteDialog.contactNote', { name: contactName(c.contact, t('inbox.row.unknownContact')) })}</p>}
        </InboxDialog>
      )}

      {noteToDelete && (
        <InboxDialog
          title={t('inbox.notes.deleteTitle')}
          onClose={() => setNoteToDelete(null)}
          initialFocusRef={noteCancelRef}
          footer={
            <>
              <InboxButton ref={noteCancelRef} onClick={() => setNoteToDelete(null)}>
                {t('inbox.deleteDialog.cancel')}
              </InboxButton>
              <InboxButton variant="danger" icon={Trash2} onClick={() => void doDeleteNote()} loading={noteDeleting}>
                {t('inbox.notes.deleteConfirm')}
              </InboxButton>
            </>
          }
        >
          <p>{t('inbox.notes.deleteText')}</p>
        </InboxDialog>
      )}

      {viewDialog && (
        <SavedViewDialog
          view={viewDialog.view}
          initial={viewDialog.initial}
          channels={channelOptions}
          agents={agentOptions}
          labels={labelOptions}
          onCancel={() => setViewDialog(null)}
          onSave={saveView}
          onDelete={viewDialog.view ? deleteView : undefined}
        />
      )}

      {bulkDialog === 'assign' && (
        <BulkAssignDialog
          rows={selectedRows}
          userId={user?.id}
          isManager={isManager}
          busy={bulkBusy}
          onCancel={() => setBulkDialog(null)}
          onConfirm={(toUserId, note) => void runBulk('/api/conversations/bulk/assign', { toUserId, ...(note ? { note } : {}) })}
        />
      )}
      {bulkDialog === 'close' && (
        <BulkCloseDialog
          rows={selectedRows}
          busy={bulkBusy}
          onCancel={() => setBulkDialog(null)}
          onConfirm={(outcome) => void runBulk('/api/conversations/bulk/close', { outcome })}
        />
      )}
      {bulkDialog === 'label' && (
        <BulkLabelDialog
          rows={selectedRows}
          catalog={labelCatalog.labels}
          canCreate={isManager}
          onCreate={labelCatalog.create}
          busy={bulkBusy}
          onCancel={() => setBulkDialog(null)}
          onConfirm={(add, remove) => void runBulk('/api/conversations/bulk/labels', { add, remove })}
        />
      )}
      {bulkDialog === 'delete' && (
        <InboxDialog
          title={t('inbox.bulk.deleteTitle', { count: selected.size })}
          onClose={() => setBulkDialog(null)}
          initialFocusRef={deleteRef}
          footer={
            <>
              <InboxButton ref={deleteRef} onClick={() => setBulkDialog(null)}>
                {t('inbox.deleteDialog.cancel')}
              </InboxButton>
              <InboxButton variant="danger" icon={Trash2} onClick={() => void bulkDelete()} loading={bulkBusy}>
                {t('inbox.bulk.deleteConfirm', { count: selected.size })}
              </InboxButton>
            </>
          }
        >
          <p>{t('inbox.bulk.deleteText', { count: selected.size })}</p>
        </InboxDialog>
      )}

      <InboxToast toast={toast} onDismiss={() => setToast(null)} />

      {helpOpen && (
        <InboxDialog
          title={t('inbox.shortcuts.title')}
          onClose={() => setHelpOpen(false)}
          footer={
            <InboxButton variant="primary" onClick={() => setHelpOpen(false)} data-autofocus>
              {t('inbox.shortcuts.done')}
            </InboxButton>
          }
        >
          <dl className={styles.shortcuts}>
            {SHORTCUTS.map(([combo, key]) => (
              <div key={key}>
                <dt>{t(`inbox.shortcuts.${key}`)}</dt>
                <dd>
                  <kbd>{combo}</kbd>
                </dd>
              </div>
            ))}
            <div>
              <dt>{t('inbox.shortcuts.palette')}</dt>
              <dd>
                <kbd>Ctrl / ⌘ K</kbd>
              </dd>
            </div>
          </dl>
        </InboxDialog>
      )}

      <div className="gsSr" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </div>
  );
}
