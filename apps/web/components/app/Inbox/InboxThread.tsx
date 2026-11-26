'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowLeft,
  Bot,
  CircleCheckBig,
  Inbox,
  Lock,
  MoreHorizontal,
  PanelRight,
  RefreshCw,
  Trash2,
  TriangleAlert,
  User,
  UserCheck,
} from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import InboxButton from './InboxButton';
import ThreadBubble from './ThreadBubble';
import ThreadComposer from './ThreadComposer';
import { getChannelMeta } from './channelMeta';
import { contactName, dayKey, dayLabel, initialsOf, waitDuration, clockTime } from './inboxFormat';
import type { ConversationThreadState, ThreadEvent } from './useConversationThread';
import type { ThreadMessage } from './types';
import styles from './InboxThread.module.css';

export interface InboxThreadProps {
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
  /** Abre la confirmación para borrar la conversación (menú "Más"). */
  onAskDelete?: () => void;
  /** Por debajo de 1600 px las acciones de la cabecera son solo el ícono (con aria-label y tooltip). */
  iconActions?: boolean;
  /** Menos de 768 px: vuelve a la lista. */
  onBack?: () => void;
  /** Por debajo de 1600 px: abre o cierra la ficha del contacto ("Detalles"). */
  onOpenContact?: () => void;
  contactOpen?: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

type Item =
  | { type: 'day'; key: string; label: string }
  | { type: 'message'; key: string; message: ThreadMessage; continued: boolean }
  | { type: 'event'; key: string; event: ThreadEvent };

const WINDOW_MS = 24 * 60 * 60 * 1000;

/** Menú "Más" (⋯) de la cabecera: por ahora, solo "Borrar conversación". */
function MoreMenu({ onDelete }: { onDelete: () => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    itemRef.current?.focus();
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
        <div className={styles.menu} role="menu" aria-label={t('inbox.thread.more')}>
          <button
            ref={itemRef}
            type="button"
            role="menuitem"
            className={`${styles.menuItem} ${styles.menuItemDanger}`}
            onClick={() => {
              close(false);
              onDelete();
            }}
          >
            <Trash2 size={15} aria-hidden="true" />
            {t('inbox.thread.delete')}
          </button>
        </div>
      )}
    </div>
  );
}

export default function InboxThread(props: InboxThreadProps) {
  const { t, language } = useTranslation();
  const { thread, userId, now } = props;
  const { conversation: c, messages, events, loading, error, hasMore, loadingOlder } = thread;

  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const restore = useRef<{ height: number; top: number } | null>(null);
  const lastSeenId = useRef<string | null>(null);
  // Lo que la persona ya vio: se actualiza solo desde el scroll (un manejador de eventos)
  const [reading, setReading] = useState<{ atBottom: boolean; upTo: string | null }>({ atBottom: true, upTo: null });

  // Mensajes y eventos en orden, con separadores por día
  const items = useMemo<Item[]>(() => {
    type Entry = { at: number; msg?: ThreadMessage; event?: ThreadEvent };
    const entries: Entry[] = [
      ...messages.map((m) => ({ at: new Date(m.createdAt).getTime(), msg: m })),
      ...events.map((e) => ({ at: new Date(e.at).getTime(), event: e })),
    ];
    // Los mensajes que se están enviando van siempre al final
    entries.sort((a, b) => (a.msg?.delivery ? 1 : 0) - (b.msg?.delivery ? 1 : 0) || a.at - b.at);
    const out: Item[] = [];
    let day = '';
    let prevAuthor = '';
    for (const entry of entries) {
      const iso = entry.msg?.createdAt ?? entry.event!.at;
      const key = dayKey(iso);
      if (key !== day) {
        day = key;
        prevAuthor = '';
        out.push({ type: 'day', key: `day-${key}`, label: dayLabel(iso, language, t) });
      }
      if (entry.event) {
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
  }, [messages, events, language, t]);

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
  const takerName = c.takeoverUserName || t('inbox.row.team');
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

  const takeButton = (
    <InboxButton
      variant="primary"
      icon={UserCheck}
      onClick={props.onTake}
      loading={thread.busy === 'take'}
      compactLabel
      iconOnly={props.iconActions}
      aria-keyshortcuts="T"
    >
      {t('inbox.thread.take')}
    </InboxButton>
  );

  return (
    <section className={styles.thread} aria-labelledby="inbox-thread-name">
      <header className={styles.head}>
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
          <h2 id="inbox-thread-name" className={styles.name}>
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
        <div className={styles.actions}>
          {!closed && !taken && props.canTakeover === true && takeButton}
          {mine && (
            <InboxButton
              icon={Bot}
              onClick={props.onRelease}
              loading={thread.busy === 'release'}
              compactLabel
              iconOnly={props.iconActions}
            >
              {t('inbox.thread.release')}
            </InboxButton>
          )}
          {!closed && (
            <InboxButton
              icon={CircleCheckBig}
              onClick={props.onAskClose}
              loading={thread.busy === 'close'}
              compactLabel
              iconOnly={props.iconActions}
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
          {props.onAskDelete && <MoreMenu onDelete={props.onAskDelete} />}
        </div>
      </header>

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

      {waitingSince && (
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
            if (item.type === 'event') {
              const e = item.event;
              return (
                <p key={item.key} className={`${styles.event} ${e.kind === 'handoff' ? styles.eventHelp : ''}`}>
                  {t(`inbox.thread.events.${e.kind}`, { name: e.name || t('inbox.row.team') })}
                  <time dateTime={e.at}>{clockTime(e.at, language)}</time>
                </p>
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

      {closed ? (
        <div className={styles.bar}>
          <Lock size={15} aria-hidden="true" />
          <span>{t('inbox.thread.closedBar')}</span>
        </div>
      ) : mine ? (
        <ThreadComposer
          key={c.id}
          conversationId={c.id}
          onSend={thread.send}
          canAttachImage={props.canAttachImage}
          canRecordVoice={props.canRecordVoice}
          windowClosed={windowClosed}
          textareaRef={props.textareaRef}
        />
      ) : taken ? (
        <div className={styles.bar}>
          <User size={15} aria-hidden="true" />
          <span>{t('inbox.thread.takenBar', { name: takerName })}</span>
        </div>
      ) : (
        <div className={styles.bar}>
          <Bot size={15} aria-hidden="true" />
          <span className={styles.barText}>{t('inbox.thread.agentBar')}</span>
          {props.canTakeover === true ? takeButton : props.canTakeover === false ? upsell : null}
        </div>
      )}
    </section>
  );
}
