import React from 'react';
import Link from 'next/link';
import { Globe, Phone } from 'lucide-react';
import Badge from '@/components/ui/Badge';
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

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'neutral'> = {
  active: 'success',
  human_takeover: 'warning',
  closed: 'neutral',
};

export default function ContactConversations({ conversations }: ContactConversationsProps) {
  if (conversations.length === 0) {
    return (
      <div className={styles.card}>
        <h3 className={styles.title}>Conversations</h3>
        <p className={styles.empty}>No conversations yet.</p>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <h3 className={styles.title}>
        Conversations
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
              <span className={styles.agent}>{conv.agent_name ?? 'Unknown agent'}</span>
              <span className={styles.meta}>
                {conv.message_count} messages · {timeAgo(conv.last_message_at ?? conv.created_at)}
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
