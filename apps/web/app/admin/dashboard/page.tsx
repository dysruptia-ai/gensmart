'use client';

import React, { useState, useEffect } from 'react';
import { Building2, Bot, MessageSquare, Users } from 'lucide-react';
import { api } from '@/lib/api';
import Spinner from '@/components/ui/Spinner';
import styles from '../admin.module.css';

interface DashboardStats {
  totalOrganizations: number;
  totalAgents: number;
  activeAgents: number;
  totalUsers: number;
  messagesToday: number;
  messagesThisMonth: number;
  conversationsToday: number;
  planBreakdown: Array<{ plan: string; count: number }>;
}

interface UsagePoint {
  date: string;
  messages: number;
}

interface RecentSignup {
  id: string;
  name: string;
  plan: string;
  created_at: string;
}

const PLAN_BADGE: Record<string, string> = {
  free: 'badgeFree',
  starter: 'badgeStarter',
  pro: 'badgePro',
  enterprise: 'badgeEnterprise',
};

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [chart, setChart] = useState<UsagePoint[]>([]);
  const [signups, setSignups] = useState<RecentSignup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<DashboardStats>('/api/admin/dashboard/stats'),
      api.get<UsagePoint[]>('/api/admin/dashboard/usage-chart?days=30'),
      api.get<RecentSignup[]>('/api/admin/dashboard/recent-signups'),
    ])
      .then(([s, c, r]) => {
        setStats(s);
        setChart(c);
        setSignups(r);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || !stats) {
    return (
      <div className={styles.loadingScreen}>
        <Spinner size="lg" />
      </div>
    );
  }

  const maxMsg = Math.max(...chart.map((c) => c.messages), 1);
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Platform Dashboard</h1>
        <p className={styles.pageDesc}>Overview of all organizations, agents, and usage</p>
      </div>

      {/* KPI Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>
            <Building2 size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            Organizations
          </p>
          <p className={styles.statValue}>{stats.totalOrganizations}</p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>
            <Bot size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            Active Agents
          </p>
          <p className={styles.statValue}>{stats.activeAgents}</p>
          <p className={styles.statSub}>{stats.totalAgents} total</p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>
            <MessageSquare size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            Messages Today
          </p>
          <p className={styles.statValue}>{stats.messagesToday.toLocaleString()}</p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>
            <Users size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            Total Users
          </p>
          <p className={styles.statValue}>{stats.totalUsers}</p>
        </div>
      </div>

      {/* Plan Breakdown + Messages This Month */}
      <div className={styles.statsGrid}>
        {stats.planBreakdown.map((pb) => (
          <div className={styles.statCard} key={pb.plan}>
            <p className={styles.statLabel}>{pb.plan} plan</p>
            <p className={styles.statValue}>{pb.count}</p>
          </div>
        ))}
        <div className={styles.statCard}>
          <p className={styles.statLabel}>Messages This Month</p>
          <p className={styles.statValue}>{stats.messagesThisMonth.toLocaleString()}</p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>Conversations Today</p>
          <p className={styles.statValue}>{stats.conversationsToday}</p>
        </div>
      </div>

      {/* Usage Chart */}
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Messages (Last 30 Days)</h2>
        {chart.length > 0 ? (
          <>
            <div className={styles.chartContainer}>
              {chart.map((point) => (
                <div
                  key={point.date}
                  className={styles.chartBar}
                  style={{ height: `${(point.messages / maxMsg) * 100}%` }}
                >
                  <span className={styles.chartTooltip}>
                    {fmtDate(point.date)}: {point.messages}
                  </span>
                </div>
              ))}
            </div>
            <div className={styles.chartLabel}>
              <span>{chart[0]?.date ? fmtDate(chart[0].date) : ''}</span>
              <span>{chart[chart.length - 1]?.date ? fmtDate(chart[chart.length - 1].date) : ''}</span>
            </div>
          </>
        ) : (
          <p className={styles.emptyState}>No message data available</p>
        )}
      </div>

      {/* Recent Signups */}
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Recent Signups</h2>
        {signups.length > 0 ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Organization</th>
                <th>Plan</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {signups.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>
                    <span className={`${styles.badge} ${styles[PLAN_BADGE[s.plan] ?? 'badgeFree']}`}>
                      {s.plan}
                    </span>
                  </td>
                  <td>{new Date(s.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className={styles.emptyState}>No signups yet</p>
        )}
      </div>
    </>
  );
}
