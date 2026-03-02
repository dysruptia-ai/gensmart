'use client';

import React from 'react';
import styles from './FunnelOverview.module.css';

interface Stage {
  stage: string;
  count: number;
  percent: number;
}

interface FunnelOverviewProps {
  stages: Stage[];
  total: number;
}

const STAGE_LABELS: Record<string, string> = {
  lead: 'Lead',
  opportunity: 'Opportunity',
  customer: 'Customer',
};

const STAGE_COLORS: Record<string, string> = {
  lead: 'var(--color-info)',
  opportunity: 'var(--color-warning)',
  customer: 'var(--color-success)',
};

export default function FunnelOverview({ stages, total }: FunnelOverviewProps) {
  return (
    <div className={styles.card}>
      <h2 className={styles.title}>Funnel Overview</h2>

      <div className={styles.stageList}>
        {stages.map(({ stage, count, percent }) => (
          <div key={stage} className={styles.stageRow}>
            <div className={styles.stageLabelRow}>
              <span
                className={styles.stageDot}
                style={{ background: STAGE_COLORS[stage] ?? 'var(--color-text-secondary)' }}
                aria-hidden="true"
              />
              <span className={styles.stageLabel}>{STAGE_LABELS[stage] ?? stage}</span>
              <span className={styles.stageCount}>{count.toLocaleString()}</span>
              <span className={styles.stagePct}>{percent}%</span>
            </div>
            <div className={styles.barTrack} aria-hidden="true">
              <div
                className={styles.barFill}
                style={{
                  width: `${percent}%`,
                  background: STAGE_COLORS[stage] ?? 'var(--color-text-secondary)',
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className={styles.total}>
        <span className={styles.totalLabel}>Total contacts</span>
        <span className={styles.totalValue}>{total.toLocaleString()}</span>
      </div>
    </div>
  );
}
