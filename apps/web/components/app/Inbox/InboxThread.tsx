'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlarmClockOff,
  ArrowDown,
  ArrowLeft,
  Bot,
  CircleCheckBig,
  Clock,
  Forward,
  Inbox,
  Lock,
  MailWarning,
  MoreHorizontal,
  Tag,
  PanelRight,
  RefreshCw,
  RotateCcw,
  Trash2,
  TriangleAlert,
  User,
  UserCheck,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import InboxButton from './InboxButton';
import { useHeaderFit } from './useHeaderFit';
import ThreadBubble from './ThreadBubble';
import ThreadComposer from './ThreadComposer';
import ThreadNote from './ThreadNote';
import LabelPicker, { type LabelPickerData } from './LabelPicker';
import type { QuickReply } from './quickReplies';
import { getChannelMeta } from './channelMeta';
import { contactName, dayKey, dayLabel, initialsOf, relativeTime, snoozeLabel, waitDuration, clockTime } from './inboxFormat';
import type { ConversationThreadState, ThreadEvent } from './useConversationThread';
import type { ApiNote, ThreadMessage } from './types';
import styles from './InboxThread.module.css';

export interface InboxThreadProps {
  /** web-45: avisos bajo la cabecera (la meta, el agente pausado) y sobre el compositor (canal desconectado). */
  topNotices?: React.ReactNode;
  composerNotices?: React.ReactNode;
  /** web-45b: pasó la meta (el aviso rojo de topNotices reemplaza al ámbar de la espera). */
  goalOver?: boolean;
  /** web-45b: el agente de la conversación está pausado (cambia el pie). */
  agentPaused?: boolean;
  thread: ConversationThreadState;
  userId: string | undefined;
  /** `null` mientras no se sabe el plan: no se muestra ni "Tomar" ni el aviso. */
  canTakeover: boolean | null;
  canAttachImage: boolean;
  canRecordVoice: boolean;
  now: number;
  onAskClose: () => void;
  onTake: () => void;
  onRelease: () => void;
  /** owner o admin de la organización: transfiere o toma conversaciones de otras personas (web-42). */
  isManager?: boolean;
  /** Zona de la organización para las horas de posponer; sin ella, la del navegador. */
  timeZone?: string;
  /** "Tomarla tú": owner/admin, cuando la tiene otra persona. */
  onTakeOver?: () => void;
  onAskTransfer?: () => void;
  onAskSnooze?: () => void;
  onUnsnooze?: () => void;
  onReopen?: () => void;
  /** Abre la confirmación para borrar la conversación (menú "Más"). Solo owner y admin. */
  onAskDelete?: () => void;
  /** Menos de 768 px: vuelve a la lista. */
  onBack?: () => void;
  /** Por debajo de 1600 px: abre o cierra la ficha del contacto ("Detalles"). */
  onOpenContact?: () => void;
  contactOpen?: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  /** web-43: respuestas rápidas, nombre de quien escribe ({agente}), notas y etiquetas. */
  quickReplies?: QuickReply[] | null;
  onUseReply?: (id: string) => void;
  myName?: string | null;
  onAskDeleteNote?: (noteId: string) => void;
  /** El selector de etiquetas, anclado al menú "Más". */
  labelPicker?: LabelPickerData;
  /** web-44: "Marcar como no leída" (también la tecla U). */
  onMarkUnread?: () => void;
}

type Item =
  | { type: 'day'; key: string; label: string }
  | { type: 'message'; key: string; message: ThreadMessage; continued: boolean }
  | { type: 'event'; key: string; event: ThreadEvent }
  | { type: 'note'; key: string; note: ApiNote };

const WINDOW_MS = 24 * 60 * 60 * 1000;

interface MenuItem {
  key: string;
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  danger?: boolean;
}

/** Menú "Más" (⋯) de la cabecera (web-42): devolver, transferir, posponer, cerrar y borrar, según estado y rol. */
function MoreMenu({ items }: { items: MenuItem[] }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const close = (focusButton: boolean) => {
    setOpen(false);
    if (focusButton) buttonRef.current?.focus();
  };

  // Flechas arriba y abajo entre las opciones
  const onMenuKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const buttons = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = e.key === 'ArrowDown' ? (index + 1) % buttons.length : (index - 1 + buttons.length) % buttons.length;
    buttons[next]?.focus();
  };

  if (!items.length) return null;

  return (
    <div
      ref={wrapRef}
      className={styles.more}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.preventDefault();
          close(true);
        }
      }}
      onBlur={(e) => {
        if (open && !wrapRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <InboxButton
        ref={buttonRef}
        variant="icon"
        icon={MoreHorizontal}
        onClick={() => setOpen((v) => !v)}
        aria-label={t('inbox.thread.more')}
        title={t('inbox.thread.more')}
        aria-haspopup="menu"
        aria-expanded={open}
      />
      {open && (
        <div ref={menuRef} className={styles.menu} role="menu" aria-label={t('inbox.thread.more')} onKeyDown={onMenuKey}>
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                className={`${styles.menuItem} ${item.danger ? styles.menuItemDanger : ''}`}
                onClick={() => {
                  close(false);
                  item.onSelect();
                }}
              >
                <Icon size={15} aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

type Translate = (key: string, values?: Record<string, string | number>) => string;

/** Texto de un evento del historial; "Tú" cuando lo hizo (o lo recibe) quien está mirando. */
export function eventText(e: ThreadEvent, userId: string | undefined, t: Translate, language: string, timeZone?: string): string {
  const mine = !!userId && e.actorId === userId;
  const name = e.name || t('inbox.row.team');
  const k = (key: string, values: Record<string, string | number> = {}) =>
    t(`inbox.thread.events.${key}${mine ? 'You' : ''}`, { name, ...values });
  switch (e.kind) {
    case 'handoff':
      return e.reason === 'agent_paused' ? t('inbox.thread.events.handoffPaused') : t('inbox.thread.events.handoff');
    case 'assigned':
      if (userId && e.targetId === userId) return t('inbox.thread.events.assignedToYou');
      return t('inbox.thread.events.assigned', { target: e.targetName || t('inbox.row.team') });
    case 'taken':
      return k('taken');
    case 'released':
      return e.actorId ? k('released') : t('inbox.thread.events.releasedPlain');
    case 'transferred': {
      if (userId && e.targetId === userId) return t('inbox.thread.events.transferredToYou', { name });
      return k('transferred', { target: e.targetName || t('inbox.row.team') });
    }
    case 'snoozed':
      return k('snoozed', { time: e.until ? snoozeLabel(e.until, language, t, timeZone) : '' });
    case 'unsnoozed':
      return e.actorId ? k('unsnoozedManual') : t('inbox.thread.events.unsnoozed');
    case 'closed':
      if (!e.actorId && !e.name) return t('inbox.thread.events.closedPlain');
      return e.outcome ? k('closedAs', { outcome: t(`inbox.outcomes.${e.outcome}`) }) : k('closed');
    case 'reopened':
      return k('reopened');
    case 'note_deleted':
      return k('noteDeleted');
    default:
      return '';
  }
}

export default function InboxThread(props: InboxThreadProps) {
  const { t, language } = useTranslation();
  const { thread, userId, now } = props;
  const { conversation: c, messages, events, notes, loading, error, hasMore, loadingOlder } = thread;
  // El selector de etiquetas se abre para una conversación: al cambiar de conversación se cierra solo
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const moreWrapRef = useRef<HTMLDivElement>(null);
  const closePicker = useCallback(() => {
    setPickerFor(null);
    moreWrapRef.current?.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')?.focus();
  }, []);
  // Las acciones llevan texto solo si el nombre cabe completo (web-42b)
  const { headRef, nameRef, actionsRef, level: fitLevel } = useHeaderFit([c?.id, c?.status, c?.takenOverBy, c?.contact?.name, language, props.onBack]);
  const iconPrimary = fitLevel >= 2;
  const iconSecondary = fitLevel >= 1;

  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const restore = useRef<{ height: number; top: number } | null>(null);
  const lastSeenId = useRef<string | null>(null);
  // Lo que la persona ya vio: se actualiza solo desde el scroll (un manejador de eventos)
  const [reading, setReading] = useState<{ atBottom: boolean; upTo: string | null }>({ atBottom: true, upTo: null });

  // Mensajes y eventos en orden, con separadores por día
  const items = useMemo<Item[]>(() => {
    type Entry = { at: number; msg?: ThreadMessage; event?: ThreadEvent; note?: ApiNote };
    // Con mensajes por cargar, una nota más vieja que el primero cargado espera a que llegue esa parte
    const firstLoaded = hasMore ? messages.find((m) => !m.delivery) : undefined;
    const floor = firstLoaded ? new Date(firstLoaded.createdAt).getTime() : -Infinity;
    const entries: Entry[] = [
      ...messages.map((m) => ({ at: new Date(m.createdAt).getTime(), msg: m })),
      ...events.map((e) => ({ at: new Date(e.at).getTime(), event: e })),
      ...notes.filter((n) => new Date(n.createdAt).getTime() >= floor).map((n) => ({ at: new Date(n.createdAt).getTime(), note: n })),
    ];
    // Los mensajes que se están enviando van siempre al final
    entries.sort((a, b) => (a.msg?.delivery ? 1 : 0) - (b.msg?.delivery ? 1 : 0) || a.at - b.at);
    const out: Item[] = [];
    let day = '';
    let prevAuthor = '';
    for (const entry of entries) {
      const iso = entry.msg?.createdAt ?? entry.note?.createdAt ?? entry.event!.at;
      const key = dayKey(iso);
      if (key !== day) {
        day = key;
        prevAuthor = '';
        out.push({ type: 'day', key: `day-${key}`, label: dayLabel(iso, language, t) });
      }
      if (entry.note) {
        prevAuthor = '';
        out.push({ type: 'note', key: `note-${entry.note.id}`, note: entry.note });
      } else if (entry.event) {
        prevAuthor = '';
        out.push({ type: 'event', key: entry.event.id, event: entry.event });
      } else if (entry.msg) {
        const m = entry.msg;
        const author = m.role === 'human' ? `human:${m.metadata.sentBy?.id ?? ''}` : m.role;
        out.push({ type: 'message', key: m.id, message: m, continued: author === prevAuthor });
        prevAuthor = m.role === 'system' ? '' : author;
      }
    }
    return out;
  }, [messages, events, notes, hasMore, language, t]);

  const scrollToBottom = useCallback((smooth = false) => {
    const el = scrollRef.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth && !reduce ? 'smooth' : 'auto' });
    atBottom.current = true;
  }, []);

  // Al abrir una conversación: al final. Con mensajes nuevos: al final solo si la persona ya estaba ahí.
  const lastMessage = messages[messages.length - 1];
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (restore.current) {
      el.scrollTop = el.scrollHeight - restore.current.height + restore.current.top;
      restore.current = null;
      return;
    }
    const lastId = lastMessage?.id ?? null;
    if (lastId === lastSeenId.current) return;
    const first = lastSeenId.current === null;
    lastSeenId.current = lastId;
    const own = lastMessage?.delivery === 'sending';
    // Si la persona está leyendo más arriba no se mueve el scroll (aparece "Mensajes nuevos")
    if (first || atBottom.current || own) {
      el.scrollTop = el.scrollHeight;
      atBottom.current = true;
    }
  }, [lastMessage, messages.length]);

  // Cambio de conversación: se empieza de cero
  useLayoutEffect(() => {
    lastSeenId.current = null;
    atBottom.current = true;
  }, [c?.id]);

  // Mensajes que llegaron después del último que se vio estando al final del hilo
  const upToIndex = reading.upTo ? messages.findIndex((m) => m.id === reading.upTo) : -1;
  const unseen =
    !reading.atBottom && upToIndex >= 0
      ? messages.slice(upToIndex + 1).filter((m) => m.role !== 'system' && !m.delivery).length
      : 0;

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    const lastId = messages[messages.length - 1]?.id ?? null;
    setReading((prev) => {
      const upTo = atBottom.current ? lastId : prev.upTo ?? lastId;
      return prev.atBottom === atBottom.current && prev.upTo === upTo ? prev : { atBottom: atBottom.current, upTo };
    });
    if (el.scrollTop < 80 && hasMore && !loadingOlder) {
      const before = { height: el.scrollHeight, top: el.scrollTop };
      void thread.loadOlder().then((loaded) => {
        if (loaded) restore.current = before;
      });
    }
  };

  // ── estados sin conversación ──
  if (loading) {
    return (
      <section className={styles.thread} aria-busy="true" aria-label={t('inbox.thread.loading')}>
        <div className={styles.head}>
          <i className={`${styles.sk} ${styles.skAvatar}`} />
          <div className={styles.skHead}>
            <i className={`${styles.sk} ${styles.skLine}`} />
            <i className={`${styles.sk} ${styles.skLineShort}`} />
          </div>
        </div>
        <div className={styles.messages}>
          <i className={`${styles.sk} ${styles.skBubble}`} />
          <i className={`${styles.sk} ${styles.skBubble} ${styles.skBubbleOut}`} />
          <i className={`${styles.sk} ${styles.skBubble}`} />
        </div>
      </section>
    );
  }

  if (error || !c) {
    const notFound = error === 'not_found';
    return (
      <section className={styles.thread}>
        {props.onBack && (
          <div className={styles.head}>
            <InboxButton variant="icon" icon={ArrowLeft} onClick={props.onBack} aria-label={t('inbox.thread.back')} />
          </div>
        )}
        <div className={styles.empty} role={error ? 'alert' : undefined}>
          <span className={`${styles.emptyIcon} ${error && !notFound ? styles.emptyIconBad : ''}`}>
            {error ? <TriangleAlert size={26} aria-hidden="true" /> : <Inbox size={26} aria-hidden="true" />}
          </span>
          <b>{t(error ? (notFound ? 'inbox.thread.notFoundTitle' : 'inbox.thread.errorTitle') : 'inbox.thread.pickTitle')}</b>
          <p>{t(error ? (notFound ? 'inbox.thread.notFoundText' : 'inbox.thread.errorText') : 'inbox.thread.pickText')}</p>
          {error === 'failed' && (
            <InboxButton variant="primary" icon={RefreshCw} onClick={() => thread.reload()}>
              {t('inbox.retry')}
            </InboxButton>
          )}
        </div>
      </section>
    );
  }

  // ── conversación abierta ──
  const name = contactName(c.contact, t('inbox.row.unknownContact'));
  const initials = initialsOf(c.contact?.name ?? '');
  const channel = getChannelMeta(c.channel);
  const ChannelIcon = channel.icon;
  const closed = c.status === 'closed';
  const taken = c.status === 'human_takeover';
  const mine = taken && !!userId && c.takenOverBy === userId;
  const takenByOther = taken && !mine;
  const takerName = c.takeoverUserName || t('inbox.row.team');
  const manager = !!props.isManager;
  const snoozedUntil = !closed ? c.snoozedUntil ?? null : null;
  // Transferir: quien la tiene, o el owner/admin (web-42); siempre que el plan deje tomar conversaciones
  const canTransfer = !closed && props.canTakeover === true && (mine || manager);
  const canReturn = taken && (mine || manager);
  const statusLabel = closed
    ? t('inbox.thread.status.closed')
    : mine
      ? t('inbox.thread.status.mine')
      : taken
        ? t('inbox.thread.status.taken', { name: takerName })
        : c.handoffActive
          ? t('inbox.thread.status.help')
          : t('inbox.thread.status.agent');
  // Espera: misma regla que "Necesitan a alguien", con los mensajes ya cargados
  const lastReal = [...messages].reverse().find((m) => m.role !== 'system');
  const askedForHelp = c.handoffActive && !c.takenOverBy && !closed;
  const waitingSince = askedForHelp
    ? c.handedOffAt
    : taken && lastReal?.role === 'user'
      ? lastReal.createdAt
      : null;
  const windowClosed =
    c.channel === 'whatsapp' && !!c.lastCustomerMessageAt && now - new Date(c.lastCustomerMessageAt).getTime() > WINDOW_MS;

  const upsell = (
    <span className={styles.upsell}>
      <Lock size={14} aria-hidden="true" />
      <span>
        {t('inbox.thread.soloNotice')}{' '}
        <Link href="/dashboard/billing" className={styles.upsellLink}>
          {t('inbox.thread.soloLink')}
        </Link>
      </span>
    </span>
  );

  const menuItems: MenuItem[] = [];
  if (canReturn) menuItems.push({ key: 'release', label: t('inbox.thread.release'), icon: Bot, onSelect: props.onRelease });
  if (canTransfer && props.onAskTransfer) {
    menuItems.push({ key: 'transfer', label: t('inbox.thread.transfer'), icon: Forward, onSelect: props.onAskTransfer });
  }
  if (!closed && snoozedUntil && props.onUnsnooze) {
    menuItems.push({ key: 'unsnooze', label: t('inbox.thread.unsnooze'), icon: AlarmClockOff, onSelect: props.onUnsnooze });
  } else if (!closed && props.onAskSnooze) {
    menuItems.push({ key: 'snooze', label: t('inbox.thread.snooze'), icon: Clock, onSelect: props.onAskSnooze });
  }
  if (!closed) menuItems.push({ key: 'close', label: t('inbox.thread.close'), icon: CircleCheckBig, onSelect: props.onAskClose });
  if (props.labelPicker) {
    menuItems.push({ key: 'labels', label: t('inbox.labels.add'), icon: Tag, onSelect: () => setPickerFor(c.id) });
  }
  if (props.onMarkUnread) {
    menuItems.push({ key: 'unread', label: t('inbox.unread.mark'), icon: MailWarning, onSelect: props.onMarkUnread });
  }
  if (props.onAskDelete) {
    menuItems.push({ key: 'delete', label: t('inbox.thread.delete'), icon: Trash2, onSelect: props.onAskDelete, danger: true });
  }

  const closedWhen = relativeTime(c.closedAt ?? c.updatedAt, language, now);
  const closedByMe = !!userId && c.closedBy === userId;
  const closedBar = (
    <div className={`${styles.bar} ${styles.closedBar}`}>
      <Lock size={15} aria-hidden="true" />
      <span className={styles.barText}>
        {c.closedOutcome ? (
          <>
            {t('inbox.thread.closedBarAs')} <b>{t(`inbox.outcomes.${c.closedOutcome}`)}</b>
          </>
        ) : (
          t('inbox.thread.closedBarPlain')
        )}{' '}
        {c.closedBy || c.closedByName
          ? closedByMe
            ? t('inbox.thread.closedBarByYou', { when: closedWhen })
            : t('inbox.thread.closedBarBy', { name: c.closedByName || t('inbox.row.team'), when: closedWhen })
          : t('inbox.thread.closedBarWhen', { when: closedWhen })}{' '}
        {t('inbox.thread.closedBarNoReply')}
      </span>
      {props.onReopen && (
        <InboxButton icon={RotateCcw} onClick={props.onReopen} loading={thread.busy === 'reopen'}>
          {t('inbox.thread.reopen')}
        </InboxButton>
      )}
    </div>
  );

  const takeButton = (
    <InboxButton
      variant="primary"
      icon={UserCheck}
      onClick={props.onTake}
      loading={thread.busy === 'take'}
      compactLabel
      iconOnly={iconPrimary}
      data-fit="primary"
      aria-keyshortcuts="T"
    >
      {t('inbox.thread.take')}
    </InboxButton>
  );

  return (
    <section className={styles.thread} aria-labelledby="inbox-thread-name">
      <header ref={headRef} className={styles.head}>
        {props.onBack && (
          <InboxButton variant="icon" icon={ArrowLeft} onClick={props.onBack} aria-label={t('inbox.thread.back')} />
        )}
        <span className={styles.avatar} aria-hidden="true">
          {c.contact?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.contact.avatarUrl} alt="" />
          ) : initials ? (
            initials
          ) : (
            <User size={17} />
          )}
          <span className={styles.channelBadge} style={{ background: channel.color }}>
            <ChannelIcon size={10} />
          </span>
        </span>
        <div className={styles.identity}>
          <h2 ref={nameRef} id="inbox-thread-name" className={styles.name}>
            {name}
          </h2>
          <p className={styles.sub}>
            <span className={styles.channel}>{channel.label}</span>
            {c.agentName && (
              <>
                <span aria-hidden="true" className={styles.agentPart}>
                  ·
                </span>
                <span className={`${styles.agent} ${styles.agentPart}`} title={c.agentName}>
                  <Bot size={12} aria-hidden="true" />
                  <span>{c.agentName}</span>
                </span>
              </>
            )}
            {/* El punto va dentro del estado: si no cabe, se van juntos */}
            <span className={`${styles.status} ${c.handoffActive && !taken && !closed ? styles.statusHelp : ''}`}>
              <span aria-hidden="true" className={styles.dot}>
                ·
              </span>
              {statusLabel}
            </span>
          </p>
        </div>
        <div ref={actionsRef} className={styles.actions}>
          {closed && props.onReopen && (
            <InboxButton
              variant="primary"
              icon={RotateCcw}
              onClick={props.onReopen}
              loading={thread.busy === 'reopen'}
              compactLabel
              iconOnly={iconPrimary}
              data-fit="primary"
            >
              {t('inbox.thread.reopen')}
            </InboxButton>
          )}
          {!closed && !taken && props.canTakeover === true && takeButton}
          {takenByOther && manager && props.canTakeover === true && props.onTakeOver && (
            <InboxButton
              variant="primary"
              icon={UserCheck}
              onClick={props.onTakeOver}
              loading={thread.busy === 'transfer'}
              compactLabel
              iconOnly={iconPrimary}
              data-fit="primary"
            >
              {t('inbox.thread.takeOver')}
            </InboxButton>
          )}
          {mine && (
            <InboxButton
              icon={Bot}
              onClick={props.onRelease}
              loading={thread.busy === 'release'}
              compactLabel
              iconOnly={iconPrimary}
              data-fit="primary"
            >
              {t('inbox.thread.release')}
            </InboxButton>
          )}
          {canTransfer && taken && props.onAskTransfer && (
            <InboxButton
              icon={Forward}
              onClick={props.onAskTransfer}
              loading={thread.busy === 'transfer'}
              compactLabel
              iconOnly={iconSecondary}
              data-fit="secondary"
            >
              {t('inbox.thread.transfer')}
            </InboxButton>
          )}
          {!closed && (
            <InboxButton
              icon={CircleCheckBig}
              onClick={props.onAskClose}
              loading={thread.busy === 'close'}
              compactLabel
              iconOnly={iconSecondary}
              data-fit="secondary"
              aria-keyshortcuts="E"
            >
              {t('inbox.thread.close')}
            </InboxButton>
          )}
          {props.onOpenContact && (
            <InboxButton
              variant="icon"
              icon={PanelRight}
              onClick={props.onOpenContact}
              aria-label={t('inbox.thread.details')}
              title={t('inbox.thread.openContact')}
              aria-expanded={props.contactOpen}
              aria-controls="inbox-details"
            />
          )}
          <div ref={moreWrapRef} className={styles.moreWrap}>
            <MoreMenu items={menuItems} />
            {pickerFor === c.id && props.labelPicker && (
              <LabelPicker {...props.labelPicker} onClose={closePicker} align="right" />
            )}
          </div>
        </div>
      </header>

      {props.topNotices}

      {!closed && !taken && props.canTakeover === false && <div className={styles.soloBar}>{upsell}</div>}

      {thread.actionError && (
        <div className={styles.actionError} role="alert">
          <TriangleAlert size={15} aria-hidden="true" />
          <span>{t(thread.actionError)}</span>
          <button type="button" onClick={thread.clearActionError}>
            {t('inbox.dialog.close')}
          </button>
        </div>
      )}

      {snoozedUntil && (
        <div className={styles.snoozeBar}>
          <Clock size={15} aria-hidden="true" />
          <span>{t('inbox.thread.snoozedBar', { when: snoozeLabel(snoozedUntil, language, t, props.timeZone) })}</span>
          {props.onUnsnooze && (
            <InboxButton icon={AlarmClockOff} onClick={props.onUnsnooze} loading={thread.busy === 'unsnooze'}>
              {t('inbox.thread.unsnooze')}
            </InboxButton>
          )}
        </div>
      )}

      {waitingSince && !props.goalOver && (
        <div className={styles.waitBar}>
          <TriangleAlert size={15} aria-hidden="true" />
          <span>
            {askedForHelp
              ? t('inbox.thread.waitHelp', { time: waitDuration(waitingSince, now) })
              : t('inbox.thread.waitReply', { time: waitDuration(waitingSince, now) })}
          </span>
        </div>
      )}

      <div className={styles.body}>
        <div ref={scrollRef} className={styles.messages} onScroll={onScroll} tabIndex={0} aria-label={t('inbox.thread.messagesLabel')}>
          {hasMore && (
            <div className={styles.older}>
              <InboxButton
                onClick={() => {
                  const el = scrollRef.current;
                  const before = el ? { height: el.scrollHeight, top: el.scrollTop } : null;
                  void thread.loadOlder().then((loaded) => {
                    if (loaded && before) restore.current = before;
                  });
                }}
                loading={loadingOlder}
              >
                {t('inbox.thread.loadOlder')}
              </InboxButton>
            </div>
          )}
          {items.length === 0 && <p className={styles.noMessages}>{t('inbox.row.noMessages')}</p>}
          {items.map((item) => {
            if (item.type === 'day') {
              return (
                <span key={item.key} className={styles.day}>
                  {item.label}
                </span>
              );
            }
            if (item.type === 'note') {
              return <ThreadNote key={item.key} note={item.note} userId={userId} onAskDelete={props.onAskDeleteNote} />;
            }
            if (item.type === 'event') {
              const e = item.event;
              return (
                <div key={item.key} className={styles.eventBlock}>
                  <p className={`${styles.event} ${e.kind === 'handoff' ? styles.eventHelp : ''}`}>
                    {eventText(e, userId, t, language, props.timeZone)}
                    <time dateTime={e.at}>{clockTime(e.at, language)}</time>
                  </p>
                  {e.note && <p className={styles.eventNote}>{e.note}</p>}
                </div>
              );
            }
            const m = item.message;
            const author =
              m.role === 'human'
                ? m.metadata.sentBy?.id && m.metadata.sentBy.id === userId
                  ? t('inbox.row.you')
                  : m.metadata.sentBy?.name || c.takeoverUserName
                : m.role === 'assistant'
                  ? c.agentName
                  : null;
            return (
              <ThreadBubble
                key={item.key}
                message={m}
                authorName={author}
                continued={item.continued}
                onRetry={thread.retry}
                onDiscard={thread.discard}
              />
            );
          })}
        </div>
        {unseen > 0 && (
          <button type="button" className={styles.newMessages} onClick={() => scrollToBottom(true)}>
            {t('inbox.thread.newMessages')}
            <ArrowDown size={14} aria-hidden="true" />
          </button>
        )}
      </div>

      {!closed && props.composerNotices}

      {closed ? (
        closedBar
      ) : mine ? (
        <ThreadComposer
          key={c.id}
          conversationId={c.id}
          onSend={thread.send}
          canAttachImage={props.canAttachImage}
          canRecordVoice={props.canRecordVoice}
          windowClosed={windowClosed}
          textareaRef={props.textareaRef}
          onSaveNote={thread.saveNote}
          quickReplies={props.quickReplies ?? null}
          onUseReply={props.onUseReply ?? (() => undefined)}
          contactName={c.contact?.name ?? null}
          agentName={props.myName ?? null}
          isManager={manager}
        />
      ) : taken ? (
        <div className={styles.bar}>
          <User size={15} aria-hidden="true" />
          <span>{t('inbox.thread.takenBar', { name: takerName })}</span>
        </div>
      ) : (
        <div className={styles.bar}>
          <Bot size={15} aria-hidden="true" />
          <span className={styles.barText}>{t(props.agentPaused ? 'inbox.thread.agentBarPaused' : 'inbox.thread.agentBar')}</span>
          {props.canTakeover === true ? takeButton : props.canTakeover === false ? upsell : null}
        </div>
      )}
    </section>
  );
}
