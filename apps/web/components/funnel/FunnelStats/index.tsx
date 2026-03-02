'use client';

import React from 'react';
import { TrendingUp, Users, UserCheck, ArrowRight } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import styles from './FunnelStats.module.css';

interface FunnelStatsData {
  totalLeads: number;
  totalOpportunities: number;
  totalCustomers: number;
  conversionLeadToOpp: number;
  conversionOppToCustomer: number;
  avgScore: number;
}

interface FunnelStatsProps {
  stats: FunnelStatsData;
}

export default function FunnelStats({ stats }: FunnelStatsProps) {
  const { t } = useTranslation();

  return (
    <div className={styles.row}>
      <div className={styles.stat}>
        <Users size={18} className={styles.icon} aria-hidden="true" />
        <div className={styles.info}>
          <span className={styles.value}>{stats.totalLeads}</span>
          <span className={styles.label}>{t('funnel.stats.leads')}</span>
        </div>
      </div>

      <ArrowRight size={16} className={styles.arrow} aria-hidden="true" />

      <div className={styles.conversion}>
        <span className={styles.pct}>{stats.conversionLeadToOpp}%</span>
        <span className={styles.convLabel}>{t('funnel.stats.leadToOpp')}</span>
      </div>

      <ArrowRight size={16} className={styles.arrow} aria-hidden="true" />

      <div className={styles.stat}>
        <TrendingUp size={18} className={styles.icon} aria-hidden="true" />
        <div className={styles.info}>
          <span className={styles.value}>{stats.totalOpportunities}</span>
          <span className={styles.label}>{t('funnel.stats.opportunities')}</span>
        </div>
      </div>

      <ArrowRight size={16} className={styles.arrow} aria-hidden="true" />

      <div className={styles.conversion}>
        <span className={styles.pct}>{stats.conversionOppToCustomer}%</span>
        <span className={styles.convLabel}>{t('funnel.stats.oppToCustomer')}</span>
      </div>

      <ArrowRight size={16} className={styles.arrow} aria-hidden="true" />

      <div className={styles.stat}>
        <UserCheck size={18} className={styles.iconGreen} aria-hidden="true" />
        <div className={styles.info}>
          <span className={styles.value}>{stats.totalCustomers}</span>
          <span className={styles.label}>{t('funnel.stats.customers')}</span>
        </div>
      </div>

      <div className={styles.divider} aria-hidden="true" />

      <div className={styles.stat}>
        <div className={styles.info}>
          <span className={styles.value}>{stats.avgScore.toFixed(1)}</span>
          <span className={styles.label}>{t('funnel.stats.avgScore')}</span>
        </div>
      </div>
    </div>
  );
}
