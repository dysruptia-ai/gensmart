'use client';

import React from 'react';
import Link from 'next/link';
import { TriangleAlert, Unplug } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { getChannelMeta } from './channelMeta';
import { sinceLabel } from './inboxFormat';
import InboxNotice from './InboxNotice';
import type { ChannelIssue } from './types';
import styles from './ChannelIssueNotice.module.css';

/** Mis agentes › ese agente › Canales. */
export function agentChannelsHref(agentId: string): string {
  return `/dashboard/agents/${encodeURIComponent(agentId)}?tab=channels`;
}

export interface ChannelIssueNoticeProps {
  issue: ChannelIssue;
  isManager: boolean;
  timeZone?: string;
  now: number;
  /** Versión corta sobre el compositor del hilo. */
  slim?: boolean;
}

/** El aviso de canal desconectado o por vencer (web-45, mockup Canal). */
export default function ChannelIssueNotice({ issue, isManager, timeZone, now, slim }: ChannelIssueNoticeProps) {
  const { t, language } = useTranslation();
  const channel = getChannelMeta(issue.channel).label;
  const disconnected = issue.kind === 'disconnected';
  const action = isManager ? (
    <Link href={agentChannelsHref(issue.agentId)} className={styles.reconnect}>
      {t('inbox.channelIssue.reconnect')}
    </Link>
  ) : undefined;

  let title: string;
  if (disconnected) {
    title = issue.since
      ? t('inbox.channelIssue.disconnectedSince', { channel, agent: issue.agentName, since: sinceLabel(issue.since, language, t, timeZone, now) })
      : t('inbox.channelIssue.disconnected', { channel, agent: issue.agentName });
  } else {
    const days = issue.expiresAt ? Math.max(0, Math.ceil((Date.parse(issue.expiresAt) - now) / 86_400_000)) : 0;
    title = t('inbox.channelIssue.expiring', { channel, agent: issue.agentName, count: days });
  }
  const detail = slim
    ? disconnected
      ? t('inbox.channelIssue.threadText')
      : null
    : disconnected
      ? t('inbox.channelIssue.disconnectedText')
      : t('inbox.channelIssue.expiringText');

  return (
    <InboxNotice
      tone={disconnected ? 'bad' : 'warn'}
      icon={disconnected ? Unplug : TriangleAlert}
      role={disconnected ? 'alert' : 'status'}
      action={action}
      slim={slim}
    >
      <b>{title}</b> {detail}
      {!isManager && <span className={styles.member}> {t('inbox.channelIssue.askAdmin')}</span>}
    </InboxNotice>
  );
}
