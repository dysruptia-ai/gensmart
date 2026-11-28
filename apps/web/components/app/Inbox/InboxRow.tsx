'use client';

import React, { memo, useRef } from 'react';
import { AlarmClock, Clock, Search, User } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { getChannelMeta } from './channelMeta';
import { isOverGoal, type GoalConfig } from './inboxGoal';
import { contactName, formatScore, initialsOf, relativeTime, snoozeLabel, waitDuration } from './inboxFormat';
import { highlightMatch, matchesQuery } from './inboxSearch';
import type { ConversationRow } from './types';
import styles from './InboxRow.module.css';

export interface InboxRowProps {
  row: ConversationRow;
  current: boolean;
  userId: string | undefined;
  now: number;
  onOpen: (id: string) => void;
  timeZone?: string;
  /** En "Cerradas": el resultado del cierre (web-42). */
  showOutcome?: boolean;
  /** web-44: la búsqueda (para resaltar el nombre y el mensaje que coincide). */
  search?: string;
  /** Modo selección: la fila es una casilla; tocarla la marca en vez de abrirla. */
  selecting?: boolean;
  checked?: boolean;
  /** Se llegó al tope del lote: las que faltan no se pueden marcar. */
  checkDisabled?: boolean;
  onToggle?: (id: string) => void;
  /** Pulsación larga (~500 ms, móvil): entra al modo selección con esta fila. */
  onLongPress?: (id: string) => void;
  /** web-45: la meta de respuesta (la espera se pone roja con "pasó la meta"). */
  goal?: GoalConfig | null;
}

const LONG_PRESS_MS = 500;

function HighlightedName({ text, query }: { text: string; query: string }) {
  return (
    <>
      {highlightMatch(text, query, { maxLength: Number.MAX_SAFE_INTEGER }).map((seg, i) =>
        seg.match ? <mark key={i}>{seg.text}</mark> : <React.Fragment key={i}>{seg.text}</React.Fragment>,
      )}
    </>
  );
}

function InboxRow({
  row,
  current,
  userId,
  now,
  onOpen,
  timeZone,
  showOutcome,
  search = '',
  selecting,
  checked,
  checkDisabled,
  onToggle,
  onLongPress,
  goal,
}: InboxRowProps) {
  const { t, language } = useTranslation();
  const query = search.trim();
  const press = useRef<{ timer: ReturnType<typeof setTimeout> | null; x: number; y: number; fired: boolean }>({
    timer: null,
    x: 0,
    y: 0,
    fired: false,
  });
  const cancelPress = () => {
    if (press.current.timer) clearTimeout(press.current.timer);
    press.current.timer = null;
  };
  const name = contactName(row.contact, t('inbox.row.unknownContact'));
  const initials = initialsOf(row.contact?.name ?? '');
  const channel = getChannelMeta(row.channel);
  const ChannelIcon = channel.icon;
  const score = row.aiScore !== null && row.aiScore >= 7 ? formatScore(row.aiScore) : null;
  const takenByMe = row.status === 'human_takeover' && !!userId && row.takenOverBy === userId;
  const takenByOther = row.status === 'human_takeover' && !takenByMe;

  // Etiquetas (web-43): la primera en orden alfabético y "+N"
  const labels = row.labels ?? [];
  const firstLabel = labels[0];

  // Quién escribió el último mensaje (con búsqueda: el mensaje que coincide)
  const match = query ? row.searchMatch : null;
  const last = match
    ? { content: match.content, role: match.role, sentById: match.sentById ?? null, sentByName: match.sentByName ?? null }
    : row.lastMessage;
  let author = '';
  if (last?.role === 'human') {
    const mine = last.sentById ? last.sentById === userId : takenByMe;
    author = mine ? t('inbox.row.you') : last.sentByName || row.takeoverUserName || t('inbox.row.team');
  } else if (last?.role === 'assistant') {
    author = row.agentName || t('inbox.row.agent');
  } else if (last?.role === 'system') {
    author = t('inbox.row.system');
  }
  const contactMatches =
    !!query && (matchesQuery(row.contact?.name, query) || matchesQuery(row.contact?.phone, query) || matchesQuery(row.contact?.email, query));
  // La fila abierta no se ve como no leída
  const unread = !!row.unread && !current;
  const className = [styles.row, row.needsAttention && styles.needs, unread && styles.unread, selecting && styles.selecting]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      {selecting && (
        <input
          type="checkbox"
          className={styles.check}
          checked={!!checked}
          disabled={checkDisabled && !checked}
          onChange={() => onToggle?.(row.id)}
          aria-label={t('inbox.bulk.selectRow', { name })}
        />
      )}
      <span className={styles.avatar} aria-hidden="true">
        {row.contact?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={row.contact.avatarUrl} alt="" className={styles.avatarImg} />
        ) : initials ? (
          initials
        ) : (
          <User size={16} />
        )}
        <span className={styles.channelBadge} style={{ background: channel.color }}>
          <ChannelIcon size={9} />
        </span>
      </span>
      <span className={styles.main}>
        <span className={styles.line1}>
          {unread && <span className={styles.unreadDot} aria-hidden="true" />}
          <b className={styles.name}>
            {unread && <span className="gsSr">{t('inbox.row.unreadSr')} </span>}
            {contactMatches && row.contact?.name ? <HighlightedName text={name} query={query} /> : name}
          </b>
          {score && (
            <span className={styles.score} title={t('inbox.row.scoreTitle')}>
              <span className="gsSr">{t('inbox.row.scoreSr')} </span>
              {score}
            </span>
          )}
          {row.lastMessageAt && (
            <time className={styles.time} dateTime={row.lastMessageAt}>
              {relativeTime(row.lastMessageAt, language, now)}
            </time>
          )}
        </span>
        <span className={styles.preview}>
          {author && <span className={styles.author}>{author}: </span>}
          {match ? (
            highlightMatch(match.content, query).map((seg, i) =>
              seg.match ? <mark key={i}>{seg.text}</mark> : <React.Fragment key={i}>{seg.text}</React.Fragment>,
            )
          ) : (
            last?.content ?? t('inbox.row.noMessages')
          )}
        </span>
        {match && !contactMatches && (
          <span className={styles.matchNote}>
            <Search size={11} aria-hidden="true" />
            {t('inbox.search.inMessage')}
          </span>
        )}
        <span className={styles.line3}>
          {row.waitingSince &&
            (isOverGoal(row.waitingSince, goal ?? null, now) ? (
              <span className={`${styles.tag} ${styles.tagBad}`}>
                <Clock size={11} aria-hidden="true" />
                {t('inbox.row.waitingOver', { time: waitDuration(row.waitingSince, now) })}
              </span>
            ) : (
              <span className={`${styles.tag} ${styles.tagWarn}`}>
                <Clock size={11} aria-hidden="true" />
                {t('inbox.row.waiting', { time: waitDuration(row.waitingSince, now) })}
              </span>
            ))}
          {row.snoozedUntil && row.status !== 'closed' && (
            <span className={`${styles.tag} ${styles.tagInfo}`}>
              <AlarmClock size={11} aria-hidden="true" />
              {t('inbox.row.snoozedUntil', { when: snoozeLabel(row.snoozedUntil, language, t, timeZone, new Date(now)) })}
            </span>
          )}
          {!row.snoozedUntil && row.followUpPending && row.status !== 'closed' && (
            <span className={`${styles.tag} ${styles.tagInfo}`}>{t('inbox.row.backFromSnooze')}</span>
          )}
          {showOutcome && row.status === 'closed' && (
            <span className={`${styles.tag} ${styles.tagMute}`}>
              {row.closedOutcome ? t(`inbox.outcomes.${row.closedOutcome}`) : t('inbox.thread.status.closed')}
            </span>
          )}
          {takenByMe && <span className={`${styles.tag} ${styles.tagOk}`}>{t('inbox.row.yours')}</span>}
          {takenByOther && (
            <span className={`${styles.tag} ${styles.tagMute}`}>
              {t('inbox.row.takenBy', { name: row.takeoverUserName || t('inbox.row.team') })}
            </span>
          )}
          <span className={styles.meta}>
            {channel.label}
            {row.agentName ? ` · ${row.agentName}` : ''}
          </span>
          {firstLabel && (
            <span className={`${styles.tag} ${styles.tagLabel}`} title={labels.map((l) => l.name).join(', ')}>
              <span className={styles.tagLabelName}>{firstLabel.name}</span>
            </span>
          )}
          {labels.length > 1 && (
            <span className={`${styles.tag} ${styles.tagLabel} ${styles.tagMore}`}>
              <span aria-hidden="true">+{labels.length - 1}</span>
              <span className="gsSr">{t('inbox.labels.more', { count: labels.length - 1 })}</span>
            </span>
          )}
        </span>
      </span>
    </>
  );

  // Modo selección: la fila es la etiqueta de su casilla (tocarla la marca)
  if (selecting) {
    return (
      <label className={className} data-conversation-id={row.id} data-checked={checked ? 'true' : undefined}>
        {content}
      </label>
    );
  }

  return (
    <button
      type="button"
      className={className}
      aria-current={current ? 'true' : undefined}
      data-conversation-id={row.id}
      onClick={() => {
        if (press.current.fired) {
          press.current.fired = false;
          return;
        }
        onOpen(row.id);
      }}
      onPointerDown={
        onLongPress
          ? (e) => {
              if (e.pointerType === 'mouse') return;
              press.current.fired = false;
              press.current.x = e.clientX;
              press.current.y = e.clientY;
              cancelPress();
              press.current.timer = setTimeout(() => {
                press.current.timer = null;
                press.current.fired = true;
                onLongPress(row.id);
              }, LONG_PRESS_MS);
            }
          : undefined
      }
      onPointerMove={(e) => {
        // Si el dedo se mueve (scroll), no es una pulsación larga
        if (press.current.timer && Math.hypot(e.clientX - press.current.x, e.clientY - press.current.y) > 10) cancelPress();
      }}
      onPointerUp={cancelPress}
      onPointerCancel={cancelPress}
      onContextMenu={(e) => {
        if (press.current.fired) e.preventDefault();
      }}
    >
      {content}
    </button>
  );
}

export default memo(InboxRow);
