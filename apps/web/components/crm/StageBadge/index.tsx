import React from 'react';
import styles from './StageBadge.module.css';

interface StageBadgeProps {
  stage: string;
  size?: 'sm' | 'md';
}

const STAGE_CONFIG: Record<string, { label: string; className: string }> = {
  lead: { label: 'Lead', className: 'lead' },
  opportunity: { label: 'Opportunity', className: 'opportunity' },
  customer: { label: 'Customer', className: 'customer' },
};

export default function StageBadge({ stage, size = 'md' }: StageBadgeProps) {
  const config = STAGE_CONFIG[stage] ?? { label: stage, className: 'lead' };
  return (
    <span className={[styles.badge, styles[config.className], styles[size]].join(' ')}>
      {config.label}
    </span>
  );
}
