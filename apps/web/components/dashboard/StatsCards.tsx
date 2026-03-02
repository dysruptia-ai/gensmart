'use client';

import React from 'react';
import { Users, MessageSquare, Star, BarChart3, TrendingUp, TrendingDown } from 'lucide-react';
import ProgressBar from '@/components/ui/ProgressBar';
import styles from './StatsCards.module.css';

interface LeadStats {
  today: number;
  todayChange: number;
  week: number;
  weekChange: number;
  month: number;
  monthChange: number;
}

interface StatsCardsProps {
  leads: LeadStats;
  activeConversations: number;
  avgLeadScore: number;
  messages: { used: number; limit: number; percent: number };
}

function ChangeBadge({ value }: { value: number }) {
  if (value === 0) return <span className={styles.changeNeutral}>—</span>;
  const Icon = value > 0 ? TrendingUp : TrendingDown;
  const cls = value > 0 ? styles.changeUp : styles.changeDown;
  return (
    <span className={cls}>
      <Icon size={12} aria-hidden="true" />
      {Math.abs(value)}%
    </span>
  );
}

function ScoreColor(score: number): string {
  if (score >= 7) return 'var(--color-success)';
  if (score >= 4) return 'var(--color-warning)';
  return 'var(--color-danger)';
}

function messageBarColor(percent: number): string {
  if (percent > 80) return 'var(--color-danger)';
  if (percent > 60) return 'var(--color-warning)';
  return 'var(--color-success)';
}

export default function StatsCards({ leads, activeConversations, avgLeadScore, messages }: StatsCardsProps) {
  return (
    <div className={styles.grid}>
      {/* Leads card */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardLabel}>Leads This Month</span>
          <span className={styles.iconWrap}>
            <Users size={18} aria-hidden="true" />
          </span>
        </div>
        <div className={styles.cardValue}>{leads.month.toLocaleString()}</div>
        <div className={styles.cardMeta}>
          <ChangeBadge value={leads.monthChange} />
          <span className={styles.cardSub}>vs last month</span>
        </div>
        <div className={styles.cardFooter}>
          Today: {leads.today} &nbsp;·&nbsp; Week: {leads.week}
        </div>
      </div>

      {/* Active conversations */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardLabel}>Active Conversations</span>
          <span className={styles.iconWrap}>
            <MessageSquare size={18} aria-hidden="true" />
          </span>
        </div>
        <div className={styles.cardValue}>{activeConversations.toLocaleString()}</div>
        <div className={styles.cardMeta}>
          <span className={styles.cardSub}>Currently open</span>
        </div>
      </div>

      {/* Avg lead score */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardLabel}>Avg Lead Score</span>
          <span className={styles.iconWrap}>
            <Star size={18} aria-hidden="true" />
          </span>
        </div>
        <div className={styles.cardValue} style={{ color: ScoreColor(avgLeadScore) }}>
          {avgLeadScore.toFixed(1)}
          <span className={styles.scoreMax}>/10</span>
        </div>
        <div className={styles.cardMeta}>
          <span className={styles.cardSub}>Across all scored contacts</span>
        </div>
      </div>

      {/* Messages used */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardLabel}>Messages Used</span>
          <span className={styles.iconWrap}>
            <BarChart3 size={18} aria-hidden="true" />
          </span>
        </div>
        <div className={styles.cardValue}>
          {messages.percent}
          <span className={styles.scoreMax}>%</span>
        </div>
        <div className={styles.progressWrap}>
          <ProgressBar value={messages.percent} color={messageBarColor(messages.percent)} />
        </div>
        <div className={styles.cardFooter}>
          {messages.used.toLocaleString()} / {messages.limit.toLocaleString()} messages
        </div>
      </div>
    </div>
  );
}
