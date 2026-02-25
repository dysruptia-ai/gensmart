'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { MoreVertical, MessageSquare, Globe, Copy, Trash2, Pencil } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import Dropdown from '@/components/ui/Dropdown';
import styles from './AgentCard.module.css';

interface Agent {
  id: string;
  name: string;
  description?: string | null;
  avatarUrl?: string | null;
  avatarInitials?: string;
  status: 'draft' | 'active' | 'paused';
  channels: string[];
  updatedAt: string;
}

interface AgentCardProps {
  agent: Agent;
  onDelete: (agent: Agent) => void;
  onDuplicate?: (agent: Agent) => void;
}

const STATUS_VARIANT = {
  active: 'success' as const,
  draft: 'neutral' as const,
  paused: 'warning' as const,
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AgentCard({ agent, onDelete, onDuplicate }: AgentCardProps) {
  const router = useRouter();

  function handleClick() {
    router.push(`/dashboard/agents/${agent.id}`);
  }

  return (
    <div className={styles.card} onClick={handleClick} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') handleClick(); }}
    >
      <div className={styles.header}>
        <div className={styles.avatarWrapper}>
          <Avatar name={agent.avatarInitials ?? agent.name} size="md" src={agent.avatarUrl ?? undefined} />
          <span className={`${styles.statusDot} ${styles[agent.status]}`} aria-label={`Status: ${agent.status}`} />
        </div>
        <div className={styles.meta}>
          <div className={styles.name}>{agent.name}</div>
          {agent.description && (
            <div className={styles.description}>{agent.description}</div>
          )}
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <Dropdown
            trigger={
              <button className={styles.menuBtn} aria-label="Agent options">
                <MoreVertical size={16} />
              </button>
            }
            items={[
              {
                label: 'Edit',
                icon: Pencil,
                onClick: () => router.push(`/dashboard/agents/${agent.id}`),
              },
              ...(onDuplicate ? [{
                label: 'Duplicate',
                icon: Copy,
                onClick: () => onDuplicate(agent),
              }] : []),
              {
                label: 'Delete',
                icon: Trash2,
                danger: true,
                dividerBefore: true,
                onClick: () => onDelete(agent),
              },
            ]}
          />
        </div>
      </div>

      <div className={styles.channels}>
        {agent.channels.includes('whatsapp') && (
          <span className={styles.channelBadge}>
            <MessageSquare size={10} /> WhatsApp
          </span>
        )}
        {agent.channels.includes('web') && (
          <span className={styles.channelBadge}>
            <Globe size={10} /> Web
          </span>
        )}
        {agent.channels.length === 0 && (
          <span className={styles.channelBadge}>No channels</span>
        )}
      </div>

      <div className={styles.footer}>
        <Badge variant={STATUS_VARIANT[agent.status]} size="sm">
          {agent.status}
        </Badge>
        <span className={styles.date}>Updated {formatDate(agent.updatedAt)}</span>
      </div>
    </div>
  );
}
