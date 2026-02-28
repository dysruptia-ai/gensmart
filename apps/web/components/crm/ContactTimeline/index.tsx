import React from 'react';
import { MessageSquare, XCircle, Clock } from 'lucide-react';
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

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

export default function ContactTimeline({ events }: ContactTimelineProps) {
  return (
    <div className={styles.card}>
      <div className={styles.titleRow}>
        <Clock size={16} aria-hidden="true" className={styles.titleIcon} />
        <h3 className={styles.title}>Timeline</h3>
      </div>
      {events.length === 0 ? (
        <p className={styles.empty}>No activity yet.</p>
      ) : (
        <div className={styles.list}>
          {events.map((ev, i) => (
            <div key={i} className={styles.event}>
              <div className={styles.iconWrap}>
                {EVENT_ICONS[ev.type] ?? <Clock size={14} aria-hidden="true" />}
              </div>
              <div className={styles.content}>
                <span className={styles.description}>{ev.description}</span>
                <span className={styles.date}>{formatDate(ev.date)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
