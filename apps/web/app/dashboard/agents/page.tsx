'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Bot } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { PLAN_LIMITS } from '@gensmart/shared';
import Button from '@/components/ui/Button';
import SearchInput from '@/components/ui/SearchInput';
import EmptyState from '@/components/ui/EmptyState';
import Spinner from '@/components/ui/Spinner';
import Modal from '@/components/ui/Modal';
import ProgressBar from '@/components/ui/ProgressBar';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/hooks/useTranslation';
import AgentCard from '@/components/agents/AgentCard';
import styles from './agents.module.css';

interface Agent {
  id: string;
  name: string;
  description?: string | null;
  avatarUrl?: string | null;
  avatarInitials?: string;
  status: 'draft' | 'active' | 'paused';
  channels: string[];
  updatedAt: string;
}

interface AgentsResponse {
  agents: Agent[];
  total: number;
  page: number;
  limit: number;
}

export default function AgentsPage() {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const { t } = useTranslation();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Agent | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [orgPlan, setOrgPlan] = useState<string>('free');

  const loadAgents = useCallback(async (q?: string) => {
    setLoading(true);
    try {
      const params = q ? `?search=${encodeURIComponent(q)}` : '';
      const data = await api.get<AgentsResponse>(`/api/agents${params}`);
      setAgents(data.agents);
      setTotal(data.total);
    } catch {
      toastError('Failed to load agents');
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    api.get<{ plan: string }>('/api/organization')
      .then((org) => { if (org.plan) setOrgPlan(org.plan); })
      .catch(() => { /* non-critical */ });
  }, []);

  useEffect(() => { loadAgents(); }, [loadAgents]);

  useEffect(() => {
    const timer = setTimeout(() => loadAgents(search), 300);
    return () => clearTimeout(timer);
  }, [search, loadAgents]);

  async function handleDelete(agent: Agent) {
    setDeleting(true);
    try {
      await api.delete(`/api/agents/${agent.id}`);
      success(t('common.delete'));
      setDeleteTarget(null);
      await loadAgents(search);
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : t('errors.generic'));
    } finally {
      setDeleting(false);
    }
  }

  async function handleDuplicate(agent: Agent) {
    try {
      const data = await api.post<{ agent: Agent }>(`/api/agents/${agent.id}/duplicate`, {});
      success(`"${data.agent.name}" created`);
      await loadAgents(search);
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : t('errors.generic'));
    }
  }

  type PlanKey = keyof typeof PLAN_LIMITS;
  const planKey = (orgPlan as PlanKey) in PLAN_LIMITS ? (orgPlan as PlanKey) : 'free';
  const rawLimit = PLAN_LIMITS[planKey].agents;
  const agentLimit = rawLimit === Infinity ? null : (rawLimit as number);

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>{t('agents.title')}</h1>
          <p className={styles.pageDesc}>{t('agents.pageDescription')}</p>
        </div>
        <Button icon={Plus} onClick={() => router.push('/dashboard/agents/new')} data-tour="new-agent-btn">
          {t('agents.newAgent')}
        </Button>
      </div>

      <div className={styles.toolbar}>
        <SearchInput
          value={search}
          onChange={(v) => setSearch(v)}
          placeholder={t('agents.search')}
        />
        <div className={styles.usageBar}>
          <span>
            {agentLimit === null
              ? t('agents.usageUnlimited', { used: String(total) })
              : t('agents.usageCount', { used: String(total), limit: String(agentLimit) })}
          </span>
          {agentLimit !== null && (
            <div className={styles.usageBarInner}>
              <ProgressBar value={Math.round((total / agentLimit) * 100)} size="sm" />
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <Spinner size="lg" />
        </div>
      ) : agents.length === 0 ? (
        <EmptyState
          icon={Bot}
          title={t('agents.empty.title')}
          description={search ? t('agents.searchEmpty') : t('agents.empty.description')}
          action={!search ? (
            <Button icon={Plus} onClick={() => router.push('/dashboard/agents/new')}>
              {t('agents.empty.cta')}
            </Button>
          ) : undefined}
        />
      ) : (
        <div className={styles.grid}>
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onDelete={(a) => setDeleteTarget(a)}
              onDuplicate={handleDuplicate}
            />
          ))}
        </div>
      )}

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={t('agents.card.deleteTitle')}
        size="sm"
      >
        <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text-secondary)', marginBottom: '1.25rem' }}>
          {t('agents.card.deleteConfirm', { name: deleteTarget?.name ?? '' })}
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>{t('common.cancel')}</Button>
          <Button
            variant="danger"
            loading={deleting}
            onClick={() => deleteTarget && handleDelete(deleteTarget)}
          >
            {t('agents.card.deleteTitle')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
