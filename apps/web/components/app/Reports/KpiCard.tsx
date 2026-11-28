'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, Lock } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import type { Comparison } from './reportsFormat';
import styles from './KpiCard.module.css';

export interface KpiCardProps {
  label: string;
  /** El número grande; null = "—" (sin casos). */
  value: string | null;
  sub: string;
  /** Una segunda línea pequeña ("124 de 168"). */
  detail?: string | null;
  comparison?: Comparison | null;
  /** "vs. ayer", "vs. los 7 días anteriores". */
  when: string;
  /** Solo: el aviso de mejorar plan en lugar del número. */
  locked?: boolean;
}

/** Un número grande de Informes (`.kpi` del diseño) con la comparación contra el período anterior. */
export default function KpiCard(props: KpiCardProps) {
  const { t } = useTranslation();
  const c = props.comparison;
  return (
    <div className={styles.kpi}>
      <span className={styles.label}>{props.label}</span>
      {props.locked ? (
        <p className={styles.locked}>
          <Lock size={14} aria-hidden="true" />
          <span>
            {t('inbox.thread.soloNotice')}{' '}
            <Link href="/dashboard/billing" className={styles.lockedLink}>
              {t('inbox.thread.soloLink')}
            </Link>
          </span>
        </p>
      ) : (
        <>
          <b className={styles.value}>{props.value ?? '—'}</b>
          <small className={styles.sub}>{props.sub}</small>
          {props.detail && <small className={styles.detail}>{props.detail}</small>}
          {c && <ComparisonLine c={c} when={props.when} />}
        </>
      )}
    </div>
  );
}

function ComparisonLine({ c, when }: { c: Comparison; when: string }) {
  const { t } = useTranslation();
  if (c.direction === 'same') return <small className={styles.cmp}>{t('reports.compare.same', { when })}</small>;
  const verdict = t(c.better ? 'reports.compare.better' : 'reports.compare.worse');
  const Icon = c.direction === 'up' ? ArrowUp : ArrowDown;
  return (
    <small className={`${styles.cmp} ${c.better ? styles.better : styles.worse}`}>
      <Icon size={13} aria-hidden="true" />
      <span aria-hidden="true">
        {c.amount} {when}
      </span>
      <span className="gsSr">{t(c.direction === 'up' ? 'reports.compare.up' : 'reports.compare.down', { amount: c.amount, when, verdict })}</span>
    </small>
  );
}
