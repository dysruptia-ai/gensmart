'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslation } from '@/hooks/useTranslation';
import styles from './TrialNotice.module.css';

const DAY = 24 * 60 * 60 * 1000;

/**
 * Días de calendario que faltan para el fin de la prueba (0 = termina hoy).
 * `null` si la prueba ya terminó: entonces no se muestra la franja.
 */
export function trialDaysLeft(trialEndsAt: string, now: Date = new Date()): number | null {
  const end = new Date(trialEndsAt);
  if (Number.isNaN(end.getTime()) || end.getTime() <= now.getTime()) return null;
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((startOf(end) - startOf(now)) / DAY);
}

/** Franja de la prueba gratis, arriba del contenido. */
export default function TrialNotice({ trialEndsAt }: { trialEndsAt: string }) {
  const { t } = useTranslation();
  const days = trialDaysLeft(trialEndsAt);
  if (days === null) return null;
  const message =
    days === 0 ? t('shell.trial.today') : days === 1 ? t('shell.trial.one') : t('shell.trial.many', { n: days });
  return (
    <div className={styles.notice} role="status">
      <span>{message}</span>
      <Link href="/dashboard/billing" className={styles.link}>{t('shell.trial.cta')}</Link>
    </div>
  );
}
