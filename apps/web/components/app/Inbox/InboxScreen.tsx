'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Trash2, WifiOff, X } from 'lucide-react';
import { PLAN_LIMITS } from '@gensmart/shared';
import { api } from '@/lib/api';
import { trapTab } from '@/lib/focus-trap';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/hooks/useTranslation';
import { useWebSocket, type WebSocketEvents } from '@/hooks/useWebSocket';
import { useOrgAgents } from '@/components/app/AppShell/useShellData';
import ContactPanel from './ContactPanel';
import InboxButton from './InboxButton';
import InboxDialog from './InboxDialog';
import InboxList from './InboxList';
import InboxMobileNav from './InboxMobileNav';
import InboxRail from './InboxRail';
import InboxThread from './InboxThread';
import { getChannelMeta } from './channelMeta';
import { contactName, inboxHref, readFilters } from './inboxFormat';
import {
  DETAILS_FIXED_QUERY,
  MOBILE_QUERY,
  WIDE_QUERY,
  useConnection,
  useDetailsPreference,
  useMediaQuery,
  useNow,
} from './useInboxEnv';
import { useInboxCounts, useInboxList } from './useInboxList';
import { normalizeIncoming, useConversationThread } from './useConversationThread';
import type { InboxFilters, InboxView } from './types';
import styles from './InboxScreen.module.css';

type PlanKey = keyof typeof PLAN_LIMITS;
type NotificationPayload = Parameters<WebSocketEvents['notification:new']>[0];

const SHORTCUTS: Array<[keys: string, key: string]> = [
  ['J / K', 'next'],
  ['T', 'take'],
  ['E', 'close'],
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
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { t } = useTranslation();
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

  // ── datos ──
  const me = useMemo(() => (user ? { id: user.id, name: user.name } : null), [user]);
  const list = useInboxList(filters, search, user?.id);
  const { counts, refresh: refreshCounts } = useInboxCounts(filters.allTime);
  const thread = useConversationThread(conversationId, me);
  const orgAgents = useOrgAgents(user?.orgId);
  const [plan, setPlan] = useState<string | null>(null);
  const [activityKey, setActivityKey] = useState(0);

  useEffect(() => {
    api
      .get<{ plan?: string }>('/api/organization')
      .then((org) => setPlan(org.plan ?? 'solo'))
      .catch(() => setPlan(null));
  }, []);
  const limits = plan ? PLAN_LIMITS[plan as PlanKey] : undefined;
  const canTakeover = limits ? limits.humanTakeover : null;

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
  const [helpOpen, setHelpOpen] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
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
  const live = useRef({ list, thread, conversationId, refreshCounts, t });
  useLayoutEffect(() => {
    live.current = { list, thread, conversationId, refreshCounts, t };
  });

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
      l.patch({
        conversationId: data.conversationId,
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
      if (data.status === 'closed' || data.status === 'active' || data.status === 'human_takeover') {
        l.patch({ conversationId: data.conversationId, status: data.status });
        if (data.status === 'closed' && data.conversationId === openId) th.applyClosed(data.updatedAt);
        rc();
      }
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

    on('message:new', handleMessage);
    on('conversation:update', handleUpdate);
    on('takeover:status', handleTakeover);
    on('notification:new', handleNotification);
    on('variables:update', handleVariables);
    on('contact:scored', handleScored);
    return () => {
      off('message:new', handleMessage);
      off('conversation:update', handleUpdate);
      off('takeover:status', handleTakeover);
      off('notification:new', handleNotification);
      off('variables:update', handleVariables);
      off('contact:scored', handleScored);
    };
  }, [on, off]);

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
      list.patch({ conversationId: id, status: 'human_takeover', takenOverBy: me.id, takeoverUserName: me.name });
      refreshCounts();
    }
  }, [thread, me, list, refreshCounts]);

  const release = useCallback(async () => {
    const id = thread.conversation?.id;
    if (id && (await thread.release())) {
      list.patch({ conversationId: id, status: 'active', takenOverBy: null, takeoverUserName: null });
      refreshCounts();
    }
  }, [thread, list, refreshCounts]);

  const askClose = useCallback(() => {
    if (c && c.status !== 'closed') setConfirmClose(true);
  }, [c]);

  const doClose = async () => {
    const id = thread.conversation?.id;
    const ok = await thread.close();
    setConfirmClose(false);
    if (ok && id) {
      list.patch({ conversationId: id, status: 'closed' });
      refreshCounts();
    }
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
  const keys = useRef({ visibleIds, conversationId, c, canTakeover, askClose, openConversation, take });
  useLayoutEffect(() => {
    keys.current = { visibleIds, conversationId, c, canTakeover, askClose, openConversation, take };
  });
  const layersOpen = railOpen || contactOpen || confirmClose || confirmDelete || helpOpen;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape') {
        if (layersOpen && !railOpen && !contactOpen) return;
        if (railOpen) setRailOpen(false);
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
  }, [railOpen, contactOpen, layersOpen, detailsOpen, setDetailsPref]);

  // Foco en los cajones al abrirlos
  useEffect(() => {
    if (railOpen) drawerRef.current?.querySelector<HTMLElement>('button')?.focus();
  }, [railOpen]);
  useEffect(() => {
    if (contactOpen) sheetRef.current?.querySelector<HTMLElement>('button')?.focus();
  }, [contactOpen]);

  // ── títulos ──
  const agentName =
    filters.agentId &&
    (orgAgents?.agents.find((a) => a.id === filters.agentId)?.name ??
      counts?.byAgent.find((a) => a.agentId === filters.agentId)?.agentName);
  const title = search
    ? t('inbox.list.results')
    : filters.agentId
      ? agentName || t('inbox.rail.unnamedAgent')
      : filters.channel
        ? getChannelMeta(filters.channel).label
        : t(`inbox.views.${filters.view}`);
  const scoped = !!(filters.agentId || filters.channel);
  const showPeriod = filters.view === 'all' || filters.view === 'closed';
  const agents = useMemo(() => (orgAgents?.agents ?? []).map((a) => ({ id: a.id, name: a.name })), [orgAgents]);

  const rail = <InboxRail filters={filters} counts={counts} agents={agents} onSelect={selectFilters} />;
  const contactPanel = (
    <ContactPanel
      conversation={c}
      loading={thread.loading}
      now={now}
      activityKey={activityKey}
      onClose={detailsFixed && !mobile ? undefined : mobile ? () => setContactOpen(false) : () => setDetailsPref(false)}
    />
  );

  const pane = mobile ? (conversationId ? 'thread' : 'list') : 'all';

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
            title={title}
            view={filters.view}
            scoped={scoped}
            allTime={filters.allTime}
            showPeriod={showPeriod}
            onPeriod={(allTime) => selectFilters({ allTime })}
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
          />
          {mobile && (
            <InboxMobileNav
              filters={filters}
              counts={counts}
              onSelect={(view: InboxView) => selectFilters({ view, agentId: null, channel: null })}
              onMore={() => setRailOpen(true)}
              moreOpen={railOpen}
            />
          )}
        </div>

        <div className={styles.threadCol}>
          {conversationId ? (
            <InboxThread
              thread={thread}
              userId={user?.id}
              canTakeover={canTakeover}
              canAttachImage={!!limits?.imageVision}
              canRecordVoice={!!limits?.voiceMessages}
              now={now}
              onAskClose={askClose}
              onTake={() => void take()}
              onRelease={() => void release()}
              onAskDelete={() => setConfirmDelete(true)}
              iconActions={!detailsFixed}
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
        <InboxDialog
          title={t('inbox.closeDialog.title')}
          onClose={() => setConfirmClose(false)}
          initialFocusRef={confirmRef}
          footer={
            <>
              <InboxButton onClick={() => setConfirmClose(false)}>{t('inbox.closeDialog.cancel')}</InboxButton>
              <InboxButton
                ref={confirmRef}
                variant="primary"
                onClick={() => void doClose()}
                loading={thread.busy === 'close'}
              >
                {t('inbox.closeDialog.confirm')}
              </InboxButton>
            </>
          }
        >
          <p>{t('inbox.closeDialog.text', { name: contactName(c.contact, t('inbox.row.unknownContact')) })}</p>
        </InboxDialog>
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
