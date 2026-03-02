'use client';

import React from 'react';
import { MessageSquare, XCircle, Clock } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { formatRelativeTime } from '@/lib/formatters';
import styles from './ContactTimeline.module.css';

interface TimelineEvent {
  type: string;
  description: string;
  date: string;
  metadata?: Record<string, unknown>;
}

interface ContactTimelineProps {
  events: TimelineEvent[];
}

const EVENT_ICONS: Record<string, React.ReactNode> = {
  conversation_started: <MessageSquare size={14} aria-hidden="true" />,
  conversation_closed: <XCircle size={14} aria-hidden="true" />,
};

export default function ContactTimeline({ events }: ContactTimelineProps) {
  const { t, language } = useTranslation();

  return (
    <div className={styles.card}>
      <div className={styles.titleRow}>
        <Clock size={16} aria-hidden="true" className={styles.titleIcon} />
        <h3 className={styles.title}>{t('contacts.detail.timeline')}</h3>
      </div>
      {events.length === 0 ? (
        <p className={styles.empty}>{t('contacts.detail.noActivity')}</p>
      ) : (
        <div className={styles.list}>
          {events.map((ev, i) => (
            <div key={i} className={styles.event}>
              <div className={styles.iconWrap}>
                {EVENT_ICONS[ev.type] ?? <Clock size={14} aria-hidden="true" />}
              </div>
              <div className={styles.content}>
                <span className={styles.description}>{ev.description}</span>
                <span className={styles.date}>{formatRelativeTime(ev.date, language)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
