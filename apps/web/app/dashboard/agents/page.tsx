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

  // Fetch org plan for accurate limit display
  useEffect(() => {
    api.get<{ plan: string }>('/api/organization')
      .then((org) => { if (org.plan) setOrgPlan(org.plan); })
      .catch(() => { /* non-critical */ });
  }, []);

  useEffect(() => { loadAgents(); }, [loadAgents]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => loadAgents(search), 300);
    return () => clearTimeout(timer);
  }, [search, loadAgents]);

  async function handleDelete(agent: Agent) {
    setDeleting(true);
    try {
      await api.delete(`/api/agents/${agent.id}`);
      success('Agent deleted');
      setDeleteTarget(null);
      await loadAgents(search);
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Failed to delete agent');
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
      toastError(err instanceof ApiError ? err.message : 'Failed to duplicate agent');
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
          <h1 className={styles.pageTitle}>AI Agents</h1>
          <p className={styles.pageDesc}>Create and manage your conversational AI agents.</p>
        </div>
        <Button icon={Plus} onClick={() => router.push('/dashboard/agents/new')}>
          New Agent
        </Button>
      </div>

      <div className={styles.toolbar}>
        <SearchInput
          value={search}
          onChange={(v) => setSearch(v)}
          placeholder="Search agents..."
        />
        <div className={styles.usageBar}>
          <span>{total} / {agentLimit === null ? '∞' : agentLimit} agents</span>
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
          title="No agents yet"
          description={search ? 'No agents match your search.' : 'Create your first AI agent to start capturing leads and automating conversations.'}
          action={!search ? (
            <Button icon={Plus} onClick={() => router.push('/dashboard/agents/new')}>
              Create Agent
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
        title="Delete Agent"
        size="sm"
      >
        <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text-secondary)', marginBottom: '1.25rem' }}>
          Are you sure you want to delete <strong>{deleteTarget?.name}</strong>?
          This action cannot be undone and all versions will be lost.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button
            variant="danger"
            loading={deleting}
            onClick={() => deleteTarget && handleDelete(deleteTarget)}
          >
            Delete Agent
          </Button>
        </div>
      </Modal>
    </div>
  );
}
