'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Filter } from 'lucide-react';
import { api } from '@/lib/api';
import Spinner from '@/components/ui/Spinner';
import EmptyState from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/hooks/useTranslation';
import KanbanBoard from '@/components/funnel/KanbanBoard';
import FunnelStats from '@/components/funnel/FunnelStats';
import styles from './funnel.module.css';

interface KanbanContact {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  ai_score: number | null;
  ai_service: string | null;
  source_channel: string | null;
  agent_name: string | null;
  funnel_stage: string;
  created_at: string;
}

interface StageData {
  id: string;
  name: string;
  contacts: KanbanContact[];
  count: number;
}

interface FunnelResponse {
  stages: StageData[];
  total: number;
}

interface FunnelStatsData {
  totalLeads: number;
  totalOpportunities: number;
  totalCustomers: number;
  conversionLeadToOpp: number;
  conversionOppToCustomer: number;
  avgScore: number;
}

interface Agent {
  id: string;
  name: string;
}

export default function FunnelPage() {
  const { t } = useTranslation();
  const [stages, setStages] = useState<StageData[]>([]);
  const [stats, setStats] = useState<FunnelStatsData | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentId, setAgentId] = useState('');
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = agentId ? `?agentId=${agentId}` : '';
      const [funnelRes, statsRes] = await Promise.all([
        api.get<FunnelResponse>(`/api/funnel${params}`),
        api.get<FunnelStatsData>('/api/funnel/stats'),
      ]);
      setStages(funnelRes.stages);
      setStats(statsRes);
    } catch {
      toast.error(t('funnel.failedToLoad'));
    } finally {
      setLoading(false);
    }
  }, [agentId, toast, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    api
      .get<{ agents: Agent[] }>('/api/agents?limit=100')
      .then((d) => setAgents(d.agents ?? []))
      .catch(() => {});
  }, []);

  const handleMove = async (contactId: string, fromStage: string, toStage: string) => {
    // Optimistic update
    setStages((prev) => {
      const contact = prev
        .flatMap((s) => s.contacts)
        .find((c) => c.id === contactId);
      if (!contact) return prev;

      return prev.map((stage) => {
        if (stage.id === fromStage) {
          return {
            ...stage,
            contacts: stage.contacts.filter((c) => c.id !== contactId),
            count: stage.count - 1,
          };
        }
        if (stage.id === toStage) {
          return {
            ...stage,
            contacts: [{ ...contact, funnel_stage: toStage }, ...stage.contacts],
            count: stage.count + 1,
          };
        }
        return stage;
      });
    });

    try {
      await api.put('/api/funnel/move', { contactId, fromStage, toStage });
      toast.success(t('funnel.movedTo', { stage: toStage }));
      // Refresh stats
      const statsRes = await api.get<FunnelStatsData>('/api/funnel/stats');
      setStats(statsRes);
    } catch {
      toast.error(t('funnel.failedToMove'));
      // Revert on failure
      fetchData();
    }
  };

  const total = stages.reduce((s, st) => s + st.count, 0);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>{t('funnel.title')}</h1>
          {!loading && (
            <span className={styles.count}>{t('funnel.contacts', { count: String(total) })}</span>
          )}
        </div>

        {agents.length > 0 && (
          <div className={styles.filterWrap}>
            <Filter size={14} className={styles.filterIcon} aria-hidden="true" />
            <select
              className={styles.select}
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              aria-label={t('funnel.filterByAgent')}
            >
              <option value="">{t('funnel.allAgents')}</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {stats && <FunnelStats stats={stats} />}

      {loading ? (
        <div className={styles.loading}>
          <Spinner size="lg" />
        </div>
      ) : total === 0 ? (
        <EmptyState
          title={t('funnel.noContacts')}
          description={t('funnel.empty.description')}
        />
      ) : (
        <KanbanBoard stages={stages} onMove={handleMove} />
      )}
    </div>
  );
}
