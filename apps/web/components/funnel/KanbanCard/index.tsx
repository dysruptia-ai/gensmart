'use client';

import React from 'react';
import Link from 'next/link';
import { Globe, MessageCircle } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import ScoreBadge from '@/components/crm/ScoreBadge';
import styles from './KanbanCard.module.css';

interface KanbanContactCard {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  ai_score: number | null;
  ai_service: string | null;
  source_channel: string | null;
  agent_name: string | null;
  created_at: string;
}

interface KanbanCardProps {
  contact: KanbanContactCard;
  stage: string;
  onDragStart: (e: React.DragEvent, contactId: string, stage: string) => void;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function KanbanCard({ contact, stage, onDragStart }: KanbanCardProps) {
  return (
    <div
      className={styles.card}
      draggable
      onDragStart={(e) => onDragStart(e, contact.id, stage)}
      aria-label={`${contact.name ?? 'Contact'} — drag to move`}
    >
      <div className={styles.top}>
        <Avatar
          src={contact.avatar_url ?? undefined}
          name={contact.name ?? 'Unknown'}
          size="sm"
        />
        <div className={styles.nameWrap}>
          <Link href={`/dashboard/contacts/${contact.id}`} className={styles.name}>
            {contact.name ?? 'Unknown'}
          </Link>
          <span className={styles.sub}>
            {contact.email ?? contact.phone ?? '—'}
          </span>
        </div>
        <ScoreBadge score={contact.ai_score} size="sm" />
      </div>
      {contact.ai_service && (
        <p className={styles.service}>{contact.ai_service}</p>
      )}
      <div className={styles.footer}>
        <span className={styles.date}>{timeAgo(contact.created_at)}</span>
        <div className={styles.badges}>
          {contact.agent_name && (
            <span className={styles.agentBadge} title={contact.agent_name}>
              {contact.agent_name.length > 12 ? contact.agent_name.slice(0, 12) + '…' : contact.agent_name}
            </span>
          )}
          {contact.source_channel && (
            <span className={styles.channelBadge} title={contact.source_channel}>
              {contact.source_channel === 'whatsapp' ? (
                <MessageCircle size={11} />
              ) : (
                <Globe size={11} />
              )}
              {contact.source_channel === 'whatsapp' ? 'WA' : 'Web'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
