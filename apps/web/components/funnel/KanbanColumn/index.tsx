'use client';

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import KanbanCard from '@/components/funnel/KanbanCard';
import styles from './KanbanColumn.module.css';

interface KanbanContact {
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

interface KanbanColumnProps {
  id: string;
  name: string;
  icon: LucideIcon;
  contacts: KanbanContact[];
  colorClass: string;
  isDragOver: boolean;
  onDragStart: (e: React.DragEvent, contactId: string, stage: string) => void;
  onDragOver: (e: React.DragEvent, stage: string) => void;
  onDrop: (e: React.DragEvent, stage: string) => void;
  onDragLeave: () => void;
}

export default function KanbanColumn({
  id,
  name,
  icon: Icon,
  contacts,
  colorClass,
  isDragOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragLeave,
}: KanbanColumnProps) {
  return (
    <div
      className={[styles.column, isDragOver ? styles.dragOver : ''].filter(Boolean).join(' ')}
      onDragOver={(e) => { e.preventDefault(); onDragOver(e, id); }}
      onDrop={(e) => onDrop(e, id)}
      onDragLeave={onDragLeave}
      aria-label={`${name} column`}
    >
      <div className={[styles.header, styles[colorClass]].join(' ')}>
        <div className={styles.headerLeft}>
          <Icon size={16} aria-hidden="true" />
          <span className={styles.columnName}>{name}</span>
        </div>
        <span className={styles.count}>{contacts.length}</span>
      </div>

      <div className={styles.cards}>
        {contacts.length === 0 ? (
          <div className={styles.emptyDrop}>
            Drop cards here
          </div>
        ) : (
          contacts.map((c) => (
            <KanbanCard
              key={c.id}
              contact={c}
              stage={id}
              onDragStart={onDragStart}
            />
          ))
        )}
      </div>
    </div>
  );
}
