'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Users,
  Download,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { api, getAccessToken } from '@/lib/api';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import EmptyState from '@/components/ui/EmptyState';
import ScoreBadge from '@/components/crm/ScoreBadge';
import StageBadge from '@/components/crm/StageBadge';
import ContactFilters from '@/components/crm/ContactFilters';
import styles from './contacts.module.css';

interface ContactItem {
  id: string;
  agent_id: string | null;
  agent_name: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  ai_score: number | null;
  ai_service: string | null;
  funnel_stage: string;
  source_channel: string | null;
  created_at: string;
}

interface ContactsResponse {
  contacts: ContactItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface Agent {
  id: string;
  name: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [search, setSearch] = useState('');
  const [agentId, setAgentId] = useState('');
  const [stage, setStage] = useState('');
  const [scoreRange, setScoreRange] = useState('');
  const [agents, setAgents] = useState<Agent[]>([]);

  const LIMIT = 20;

  const parseScoreRange = (range: string): { scoreMin?: number; scoreMax?: number } => {
    if (!range) return {};
    const [min, max] = range.split('-').map(Number);
    return { scoreMin: min, scoreMax: max };
  };

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const { scoreMin, scoreMax } = parseScoreRange(scoreRange);
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
        ...(search && { search }),
        ...(agentId && { agentId }),
        ...(stage && { stage }),
        ...(scoreMin !== undefined && { scoreMin: String(scoreMin) }),
        ...(scoreMax !== undefined && { scoreMax: String(scoreMax) }),
      });
      const data = await api.get<ContactsResponse>(`/api/contacts?${params}`);
      setContacts(data.contacts);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch {
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, agentId, stage, scoreRange]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  useEffect(() => {
    api
      .get<{ agents: Agent[] }>('/api/agents?limit=100')
      .then((d) => setAgents(d.agents ?? []))
      .catch(() => {});
  }, []);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [search, agentId, stage, scoreRange]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const { scoreMin, scoreMax } = parseScoreRange(scoreRange);
      const token = getAccessToken();
      const res = await fetch(
        `${process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000'}/api/contacts/export`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            ...(search && { search }),
            ...(agentId && { agentId }),
            ...(stage && { funnelStage: stage }),
            ...(scoreMin !== undefined && { scoreMin }),
            ...(scoreMax !== undefined && { scoreMax }),
          }),
        }
      );
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'contacts.csv';
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      // ignore
    } finally {
      setExporting(false);
    }
  };

  const channelVariant = (ch: string | null): 'info' | 'success' => {
    return ch === 'whatsapp' ? 'success' : 'info';
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Contacts</h1>
          {!loading && (
            <span className={styles.count}>{total.toLocaleString()} total</span>
          )}
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={Download}
          loading={exporting}
          onClick={handleExport}
        >
          Export CSV
        </Button>
      </div>

      <ContactFilters
        search={search}
        onSearchChange={setSearch}
        agentId={agentId}
        onAgentChange={setAgentId}
        stage={stage}
        onStageChange={setStage}
        scoreRange={scoreRange}
        onScoreRangeChange={setScoreRange}
        agents={agents}
      />

      {loading ? (
        <div className={styles.loading}>
          <Spinner size="lg" />
        </div>
      ) : contacts.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No contacts yet"
          description="Contacts are created automatically when agents capture variables from conversations."
        />
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Contact</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Agent</th>
                  <th>Score</th>
                  <th>Stage</th>
                  <th>Service</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/dashboard/contacts/${c.id}`} className={styles.nameCell}>
                        <Avatar
                          src={c.avatar_url ?? undefined}
                          name={c.name ?? 'Unknown'}
                          size="sm"
                        />
                        <span className={styles.name}>{c.name ?? 'Unknown'}</span>
                      </Link>
                    </td>
                    <td className={styles.secondary}>{c.email ?? '—'}</td>
                    <td className={styles.secondary}>{c.phone ?? '—'}</td>
                    <td>
                      {c.agent_name ? (
                        <div className={styles.agentCell}>
                          <span className={styles.agentName}>{c.agent_name}</span>
                          {c.source_channel && (
                            <Badge variant={channelVariant(c.source_channel)} size="sm">
                              {c.source_channel}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className={styles.secondary}>—</span>
                      )}
                    </td>
                    <td>
                      <ScoreBadge score={c.ai_score} />
                    </td>
                    <td>
                      <StageBadge stage={c.funnel_stage} />
                    </td>
                    <td className={styles.secondary}>{c.ai_service ?? '—'}</td>
                    <td className={styles.secondary}>{timeAgo(c.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className={styles.pagination}>
              <Button
                variant="ghost"
                size="sm"
                icon={ChevronLeft}
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Prev
              </Button>
              <span className={styles.pageInfo}>
                Page {page} of {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                icon={ChevronRight}
                iconPosition="right"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
