import React from 'react';
import { TrendingUp, Users, UserCheck, ArrowRight } from 'lucide-react';
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
  return (
    <div className={styles.row}>
      <div className={styles.stat}>
        <Users size={18} className={styles.icon} aria-hidden="true" />
        <div className={styles.info}>
          <span className={styles.value}>{stats.totalLeads}</span>
          <span className={styles.label}>Leads</span>
        </div>
      </div>

      <ArrowRight size={16} className={styles.arrow} aria-hidden="true" />

      <div className={styles.conversion}>
        <span className={styles.pct}>{stats.conversionLeadToOpp}%</span>
        <span className={styles.convLabel}>Lead → Opp</span>
      </div>

      <ArrowRight size={16} className={styles.arrow} aria-hidden="true" />

      <div className={styles.stat}>
        <TrendingUp size={18} className={styles.icon} aria-hidden="true" />
        <div className={styles.info}>
          <span className={styles.value}>{stats.totalOpportunities}</span>
          <span className={styles.label}>Opportunities</span>
        </div>
      </div>

      <ArrowRight size={16} className={styles.arrow} aria-hidden="true" />

      <div className={styles.conversion}>
        <span className={styles.pct}>{stats.conversionOppToCustomer}%</span>
        <span className={styles.convLabel}>Opp → Customer</span>
      </div>

      <ArrowRight size={16} className={styles.arrow} aria-hidden="true" />

      <div className={styles.stat}>
        <UserCheck size={18} className={styles.iconGreen} aria-hidden="true" />
        <div className={styles.info}>
          <span className={styles.value}>{stats.totalCustomers}</span>
          <span className={styles.label}>Customers</span>
        </div>
      </div>

      <div className={styles.divider} aria-hidden="true" />

      <div className={styles.stat}>
        <div className={styles.info}>
          <span className={styles.value}>{stats.avgScore.toFixed(1)}</span>
          <span className={styles.label}>Avg Score</span>
        </div>
      </div>
    </div>
  );
}
