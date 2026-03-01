'use client';

import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './CalendarView.module.css';

// ── Timezone-aware date helpers ────────────────────────────────────────────

export function getDayInTimezone(isoString: string, timezone: string): number {
  return parseInt(
    new Intl.DateTimeFormat('en-US', { day: 'numeric', timeZone: timezone }).format(new Date(isoString))
  );
}

export function getMonthInTimezone(isoString: string, timezone: string): number {
  return (
    parseInt(new Intl.DateTimeFormat('en-US', { month: 'numeric', timeZone: timezone }).format(new Date(isoString))) - 1
  );
}

export function getYearInTimezone(isoString: string, timezone: string): number {
  return parseInt(
    new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone: timezone }).format(new Date(isoString))
  );
}

function formatTimeInTimezone(isoString: string, timezone: string): string {
  try {
    return new Date(isoString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone,
    });
  } catch {
    return new Date(isoString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }
}

export interface Appointment {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  status: string;
  contact_name?: string | null;
  calendar_name?: string | null;
  calendar_timezone?: string | null;
  agent_name?: string | null;
}

interface Props {
  year: number;
  month: number; // 0-indexed
  appointments: Appointment[];
  selectedDay: number | null;
  onDaySelect: (day: number) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function CalendarView({
  year,
  month,
  appointments,
  selectedDay,
  onDaySelect,
  onPrevMonth,
  onNextMonth,
}: Props) {
  const today = new Date();
  const todayY = today.getFullYear();
  const todayM = today.getMonth();
  const todayD = today.getDate();

  // Build calendar grid: weeks × 7 cells
  const cells = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    // Monday-first: 0=Mon..6=Sun
    const startOffset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const result: Array<{ day: number; currentMonth: boolean }> = [];

    for (let i = 0; i < startOffset; i++) {
      result.push({ day: prevMonthDays - startOffset + 1 + i, currentMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      result.push({ day: d, currentMonth: true });
    }
    const remaining = 42 - result.length;
    for (let i = 1; i <= remaining; i++) {
      result.push({ day: i, currentMonth: false });
    }

    return result;
  }, [year, month]);

  // Group appointments by day (in each appointment's own calendar timezone)
  const apptsByDay = useMemo(() => {
    const map: Record<number, Appointment[]> = {};
    for (const a of appointments) {
      const tz = a.calendar_timezone || 'UTC';
      const aYear = getYearInTimezone(a.start_time, tz);
      const aMonth = getMonthInTimezone(a.start_time, tz);
      if (aYear === year && aMonth === month) {
        const day = getDayInTimezone(a.start_time, tz);
        if (!map[day]) map[day] = [];
        map[day]!.push(a);
      }
    }
    return map;
  }, [appointments, year, month]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <span className={styles.monthTitle}>
          {MONTH_NAMES[month]} {year}
        </span>
        <div className={styles.navButtons}>
          <button className={styles.navBtn} onClick={onPrevMonth} aria-label="Previous month">
            <ChevronLeft size={16} />
          </button>
          <button className={styles.navBtn} onClick={onNextMonth} aria-label="Next month">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className={styles.grid}>
        {DAY_NAMES.map((d) => (
          <div key={d} className={styles.dayHeader}>{d}</div>
        ))}

        {cells.map((cell, i) => {
          if (!cell.currentMonth) {
            return (
              <div key={`empty-${i}`} className={`${styles.dayCell} ${styles.dayCellEmpty}`}>
                <span className={`${styles.dayNumber} ${styles.dayNumberOtherMonth}`}>
                  {cell.day}
                </span>
              </div>
            );
          }

          const isToday = todayY === year && todayM === month && todayD === cell.day;
          const isSelected = selectedDay === cell.day;
          const dayAppts = apptsByDay[cell.day] ?? [];
          const MAX_VISIBLE = 3;

          let cellClass = styles.dayCell;
          if (isToday) cellClass += ` ${styles.dayCellToday}`;
          if (isSelected) cellClass += ` ${styles.dayCellSelected}`;

          return (
            <div
              key={`day-${cell.day}`}
              className={cellClass}
              onClick={() => onDaySelect(cell.day)}
            >
              <span className={styles.dayNumber}>{cell.day}</span>
              <div className={styles.dots}>
                {dayAppts.slice(0, MAX_VISIBLE).map((a) => {
                  let dotClass = styles.apptDot;
                  if (a.status === 'cancelled') dotClass += ` ${styles.apptDotCancelled}`;
                  else if (a.status === 'completed') dotClass += ` ${styles.apptDotCompleted}`;
                  const time = formatTimeInTimezone(a.start_time, a.calendar_timezone || 'UTC');
                  return (
                    <div key={a.id} className={dotClass} title={a.title}>
                      {time} {a.title}
                    </div>
                  );
                })}
                {dayAppts.length > MAX_VISIBLE && (
                  <span className={styles.moreBadge}>
                    +{dayAppts.length - MAX_VISIBLE} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
