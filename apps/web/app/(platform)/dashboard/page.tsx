'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Skeleton from '@/components/ui/Skeleton';
import StatsCards from '@/components/dashboard/StatsCards';
import LeadsChart from '@/components/dashboard/LeadsChart';
import FunnelOverview from '@/components/dashboard/FunnelOverview';
import TopAgents from '@/components/dashboard/TopAgents';
import RecentLeads from '@/components/dashboard/RecentLeads';
import styles from './home.module.css';

interface StatsData {
  leads: {
    today: number;
    todayChange: number;
    week: number;
    weekChange: number;
    month: number;
    monthChange: number;
  };
  activeConversations: number;
  avgLeadScore: number;
  messages: { used: number; limit: number; percent: number };
}

interface FunnelData {
  stages: Array<{ stage: string; count: number; percent: number }>;
  total: number;
}

interface TopAgentsData {
  agents: Array<{
    id: string;
    name: string;
    avatarUrl: string | null;
    avatarInitials: string | null;
    status: string;
    conversationCount: number;
    contactCount: number;
    avgScore: number | null;
  }>;
}

interface RecentLeadsData {
  leads: Array<{
    id: string;
    name: string | null;
    email: string | null;
    score: number | null;
    service: string | null;
    createdAt: string;
    agentName: string | null;
    agentId: string | null;
  }>;
}

export default function DashboardHomePage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [funnel, setFunnel] = useState<FunnelData | null>(null);
  const [topAgents, setTopAgents] = useState<TopAgentsData | null>(null);
  const [recentLeads, setRecentLeads] = useState<RecentLeadsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<StatsData>('/api/dashboard/stats'),
      api.get<FunnelData>('/api/dashboard/funnel-overview'),
      api.get<TopAgentsData>('/api/dashboard/top-agents'),
      api.get<RecentLeadsData>('/api/dashboard/recent-leads'),
    ])
      .then(([statsRes, funnelRes, agentsRes, leadsRes]) => {
        setStats(statsRes);
        setFunnel(funnelRes);
        setTopAgents(agentsRes);
        setRecentLeads(leadsRes);
      })
      .catch(() => {/* ignore — individual components handle empty state */})
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Dashboard</h1>
      </div>

      {/* Row 1: Stats Cards */}
      {isLoading || !stats ? (
        <div className={styles.statsSkeletons}>
          <Skeleton height={120} />
          <Skeleton height={120} />
          <Skeleton height={120} />
          <Skeleton height={120} />
        </div>
      ) : (
        <StatsCards
          leads={stats.leads}
          activeConversations={stats.activeConversations}
          avgLeadScore={stats.avgLeadScore}
          messages={stats.messages}
        />
      )}

      {/* Row 2: Leads Chart + Funnel Overview */}
      <div className={styles.row2}>
        <div className={styles.chartCol}>
          <LeadsChart />
        </div>
        <div className={styles.funnelCol}>
          {isLoading || !funnel ? (
            <Skeleton height={280} />
          ) : (
            <FunnelOverview stages={funnel.stages} total={funnel.total} />
          )}
        </div>
      </div>

      {/* Row 3: Top Agents + Recent Leads */}
      <div className={styles.row3}>
        <div className={styles.halfCol}>
          {isLoading || !topAgents ? (
            <Skeleton height={280} />
          ) : (
            <TopAgents agents={topAgents.agents} />
          )}
        </div>
        <div className={styles.halfCol}>
          {isLoading || !recentLeads ? (
            <Skeleton height={280} />
          ) : (
            <RecentLeads leads={recentLeads.leads} />
          )}
        </div>
      </div>
    </div>
  );
}
