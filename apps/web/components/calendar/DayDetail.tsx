'use client';

import React from 'react';
import { CalendarDays, Plus } from 'lucide-react';
import Button from '@/components/ui/Button';
import styles from './DayDetail.module.css';
import type { Appointment } from './CalendarView';

interface Props {
  date: string; // YYYY-MM-DD
  appointments: Appointment[];
  onNewAppointment: () => void;
  onSelectAppointment: (a: Appointment) => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatDayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const dt = new Date(y, m - 1, d);
  const dayName = dt.toLocaleDateString('en-US', { weekday: 'long' });
  return `${dayName}, ${MONTH_NAMES[m - 1]} ${d}`;
}

function getDuration(start: string, end: string): string {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export default function DayDetail({ date, appointments, onNewAppointment, onSelectAppointment }: Props) {
  const sorted = [...appointments].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <span className={styles.panelTitle}>{formatDayLabel(date)}</span>
        <Button size="sm" variant="primary" icon={Plus} onClick={onNewAppointment}>
          New
        </Button>
      </div>

      <div className={styles.list}>
        {sorted.length === 0 ? (
          <div className={styles.emptyState}>
            <CalendarDays size={28} />
            <span>No appointments this day</span>
          </div>
        ) : (
          sorted.map((a) => {
            const startDate = new Date(a.start_time);
            const timeStart = startDate.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              ...(a.calendar_timezone ? { timeZone: a.calendar_timezone } : {}),
            });
            const duration = getDuration(a.start_time, a.end_time);

            let colorBarClass = styles.colorBar;
            let badgeClass = styles.badge + ' ' + styles.badgeScheduled;
            let badgeLabel = 'Scheduled';
            if (a.status === 'cancelled') {
              colorBarClass += ' ' + styles.colorBarCancelled;
              badgeClass = styles.badge + ' ' + styles.badgeCancelled;
              badgeLabel = 'Cancelled';
            } else if (a.status === 'completed') {
              colorBarClass += ' ' + styles.colorBarCompleted;
              badgeClass = styles.badge + ' ' + styles.badgeCompleted;
              badgeLabel = 'Completed';
            }

            return (
              <div key={a.id} className={styles.item} onClick={() => onSelectAppointment(a)}>
                <div className={styles.timeCol}>
                  <span className={styles.timeStart}>{timeStart}</span>
                  <span className={styles.timeDuration}>{duration}</span>
                </div>
                <div className={colorBarClass} />
                <div className={styles.info}>
                  <div className={styles.itemTitle}>{a.title}</div>
                  <div className={styles.itemMeta}>
                    {a.contact_name && <span>{a.contact_name} · </span>}
                    {a.calendar_name && <span>{a.calendar_name}</span>}
                  </div>
                </div>
                <span className={badgeClass}>{badgeLabel}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
