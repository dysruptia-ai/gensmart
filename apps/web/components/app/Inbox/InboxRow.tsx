'use client';

import React, { memo } from 'react';
import { Clock, User } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { getChannelMeta } from './channelMeta';
import { contactName, formatScore, initialsOf, relativeTime, waitDuration } from './inboxFormat';
import type { ConversationRow } from './types';
import styles from './InboxRow.module.css';

export interface InboxRowProps {
  row: ConversationRow;
  current: boolean;
  userId: string | undefined;
  now: number;
  onOpen: (id: string) => void;
}

function InboxRow({ row, current, userId, now, onOpen }: InboxRowProps) {
  const { t, language } = useTranslation();
  const name = contactName(row.contact, t('inbox.row.unknownContact'));
  const initials = initialsOf(row.contact?.name ?? '');
  const channel = getChannelMeta(row.channel);
  const ChannelIcon = channel.icon;
  const score = row.aiScore !== null && row.aiScore >= 7 ? formatScore(row.aiScore) : null;
  const takenByMe = row.status === 'human_takeover' && !!userId && row.takenOverBy === userId;
  const takenByOther = row.status === 'human_takeover' && !takenByMe;

  // Quién escribió el último mensaje
  const last = row.lastMessage;
  let author = '';
  if (last?.role === 'human') {
    const mine = last.sentById ? last.sentById === userId : takenByMe;
    author = mine ? t('inbox.row.you') : last.sentByName || row.takeoverUserName || t('inbox.row.team');
  } else if (last?.role === 'assistant') {
    author = row.agentName || t('inbox.row.agent');
  } else if (last?.role === 'system') {
    author = t('inbox.row.system');
  }

  return (
    <button
      type="button"
      className={[styles.row, row.needsAttention && styles.needs].filter(Boolean).join(' ')}
      aria-current={current ? 'true' : undefined}
      data-conversation-id={row.id}
      onClick={() => onOpen(row.id)}
    >
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
          <b className={styles.name}>{name}</b>
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
          {last?.content ?? t('inbox.row.noMessages')}
        </span>
        <span className={styles.line3}>
          {row.waitingSince && (
            <span className={`${styles.tag} ${styles.tagWarn}`}>
              <Clock size={11} aria-hidden="true" />
              {t('inbox.row.waiting', { time: waitDuration(row.waitingSince, now) })}
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
        </span>
      </span>
    </button>
  );
}

export default memo(InboxRow);
