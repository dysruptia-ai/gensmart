'use client';

import React from 'react';
import Link from 'next/link';
import { Globe, Phone } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import { useTranslation } from '@/hooks/useTranslation';
import { formatRelativeTime } from '@/lib/formatters';
import styles from './ContactConversations.module.css';

interface ConversationItem {
  id: string;
  agent_name: string | null;
  channel: string;
  status: string;
  message_count: number;
  last_message_at: string | null;
  created_at: string;
}

interface ContactConversationsProps {
  conversations: ConversationItem[];
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'neutral'> = {
  active: 'success',
  human_takeover: 'warning',
  closed: 'neutral',
};

export default function ContactConversations({ conversations }: ContactConversationsProps) {
  const { t, language } = useTranslation();

  if (conversations.length === 0) {
    return (
      <div className={styles.card}>
        <h3 className={styles.title}>{t('contacts.detail.conversations')}</h3>
        <p className={styles.empty}>{t('contacts.detail.noConversations')}</p>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <h3 className={styles.title}>
        {t('contacts.detail.conversations')}
        <span className={styles.count}>{conversations.length}</span>
      </h3>
      <div className={styles.list}>
        {conversations.map((conv) => (
          <Link
            key={conv.id}
            href={`/dashboard/conversations/${conv.id}`}
            className={styles.item}
          >
            <div className={styles.channelIcon}>
              {conv.channel === 'whatsapp' ? (
                <Phone size={14} aria-hidden="true" />
              ) : (
                <Globe size={14} aria-hidden="true" />
              )}
            </div>
            <div className={styles.info}>
              <span className={styles.agent}>{conv.agent_name ?? t('contacts.detail.unknownAgent')}</span>
              <span className={styles.meta}>
                {t('contacts.detail.messages', { count: String(conv.message_count) })} · {formatRelativeTime(conv.last_message_at ?? conv.created_at, language)}
              </span>
            </div>
            <Badge
              variant={STATUS_VARIANT[conv.status] ?? 'neutral'}
              size="sm"
            >
              {conv.status.replace('_', ' ')}
            </Badge>
          </Link>
        ))}
      </div>
    </div>
  );
}
