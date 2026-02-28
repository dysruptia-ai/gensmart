import React from 'react';
import styles from './ScoreBadge.module.css';

interface ScoreBadgeProps {
  score: number | null;
  size?: 'sm' | 'md' | 'lg';
}

function getScoreVariant(score: number): 'danger' | 'warning' | 'success' {
  if (score <= 3) return 'danger';
  if (score <= 6) return 'warning';
  return 'success';
}

export default function ScoreBadge({ score, size = 'md' }: ScoreBadgeProps) {
  if (score === null || score === undefined) {
    return <span className={[styles.badge, styles.neutral, styles[size]].join(' ')}>—</span>;
  }

  const variant = getScoreVariant(score);
  return (
    <span className={[styles.badge, styles[variant], styles[size]].join(' ')}>
      {score}/10
    </span>
  );
}
