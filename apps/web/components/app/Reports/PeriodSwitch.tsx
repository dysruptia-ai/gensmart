'use client';

import React from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { REPORT_PERIODS, type ReportPeriodKey } from './types';
import styles from './PeriodSwitch.module.css';

export interface PeriodSwitchProps {
  value: ReportPeriodKey;
  onChange: (period: ReportPeriodKey) => void;
}

/** Hoy · 7 días · 30 días. El mismo control segmentado de la Bandeja (botones con aria-pressed). */
export default function PeriodSwitch({ value, onChange }: PeriodSwitchProps) {
  const { t } = useTranslation();
  return (
    <div className={styles.switch} role="group" aria-label={t('reports.period.label')}>
      {REPORT_PERIODS.map((p) => (
        <button key={p} type="button" aria-pressed={value === p} onClick={() => onChange(p)}>
          {t(`reports.period.${p}`)}
        </button>
      ))}
    </div>
  );
}
