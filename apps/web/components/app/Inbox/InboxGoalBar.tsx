'use client';

import React from 'react';
import { Clock } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { formatWaitMinutes, goalBarState, type GoalConfig } from './inboxGoal';
import { formatOpening } from './inboxFormat';
import styles from './InboxGoalBar.module.css';

export interface InboxGoalBarProps {
  oldestWaitingSince: string | null | undefined;
  goal: GoalConfig | null;
  now: number;
}

/**
 * La barra de la meta arriba de "Necesitan a alguien" (web-45, el `.sla` del diseño). Ámbar dentro de
 * la meta, roja al pasarla; fuera de horario, la nota de cuándo se retoma (nunca roja).
 */
export default function InboxGoalBar({ oldestWaitingSince, goal, now }: InboxGoalBarProps) {
  const { t, language } = useTranslation();
  if (!goal) return null;
  const state = goalBarState(oldestWaitingSince, goal, now);
  if (state.kind === 'none') return null;
  if (state.kind === 'closed') {
    return (
      <div className={`${styles.sla} ${styles.closed}`} role="status">
        <span>
          <Clock size={14} aria-hidden="true" />{' '}
          {state.nextOpening
            ? t('inbox.goal.closed', { when: formatOpening(state.nextOpening, language, t, goal.timeZone, now) })
            : t('inbox.goal.closedNoOpening')}
        </span>
      </div>
    );
  }
  const over = state.kind === 'over';
  return (
    <div className={`${styles.sla} ${over ? styles.over : ''}`} role="status">
      <span>
        <b>{t('inbox.goal.oldest', { time: formatWaitMinutes(state.waitMinutes) })}</b>{' '}
        {t('inbox.goal.target', { minutes: goal.goalMinutes })}
        {over && <span className="gsSr"> {t('inbox.goal.overSr')}</span>}
      </span>
      <span
        className={styles.bar}
        role="progressbar"
        aria-label={t('inbox.goal.progress')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={state.percent}
      >
        <i style={{ width: `${state.percent}%` }} />
      </span>
    </div>
  );
}
