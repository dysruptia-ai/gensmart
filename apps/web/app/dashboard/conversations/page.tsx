'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  MessageSquare,
  Globe,
  Phone,
  Filter,
  RefreshCw,
  Trash2,
  UserRound,
} from 'lucide-react';
import { api } from '@/lib/api';
import Badge from '@/components/ui/Badge';
import Avatar from '@/components/ui/Avatar';
import SearchInput from '@/components/ui/SearchInput';
import EmptyState from '@/components/ui/EmptyState';
import Spinner from '@/components/ui/Spinner';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useTranslation } from '@/hooks/useTranslation';
import { formatRelativeTime } from '@/lib/formatters';
import styles from './conversations.module.css';

interface ConversationItem {
  id: string;
  agentId: string;
  agentName: string;
  contact: {
    id: string;
    name: string | null;
    phone: string | null;
    email: string | null;
    avatarUrl: string | null;
  } | null;
  channel: 'web' | 'whatsapp';
  status: 'active' | 'human_takeover' | 'closed';
  takenOverBy: string | null;
  takeoverUserName: string | null;
  aiScore: number | null;
  capturedVariables: Record<string, unknown>;
  lastMessageAt: string | null;
  messageCount: number;
  createdAt: string;
  lastMessage: { content: string; role: string } | null;
}

interface ConversationsResponse {
  conversations: ConversationItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface AgentOption {
  id: string;
  name: string;
}

function isRecentlyActive(lastMessageAt: string | null): boolean {
  if (!lastMessageAt) return false;
  return Date.now() - new Date(lastMessageAt).getTime() < 2 * 60 * 1000;
}

function needsHelp(status: string): boolean {
  return status === 'human_takeover' || status === 'takeover_requested';
}

export default function ConversationsPage() {
  const { t, language } = useTranslation();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [agentFilter, setAgentFilter] = useState('');
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [total, setTotal] = useState(0);
  const { on, off } = useWebSocket();

  // Selection state for bulk delete
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Fetch agents list for filter dropdown
  useEffect(() => {
    void (async () => {
      try {
        const data = await api.get<{ agents: AgentOption[] }>('/api/agents');
        setAgents(data.agents);
      } catch {
        // Non-critical
      }
    })();
  }, []);

  const fetchConversations = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (channelFilter) params.set('channel', channelFilter);
      if (agentFilter) params.set('agentId', agentFilter);

      const data = await api.get<ConversationsResponse>(`/api/conversations?${params}`);

      // Sort: takeover conversations first, then by last message time
      const sorted = [...data.conversations].sort((a, b) => {
        const aHelp = needsHelp(a.status) ? 0 : 1;
        const bHelp = needsHelp(b.status) ? 0 : 1;
        if (aHelp !== bHelp) return aHelp - bHelp;
        return 0; // preserve server order for same priority
      });

      setConversations(sorted);
      setTotal(data.pagination.total);
    } catch (err) {
      console.error('[conversations] Fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, channelFilter, agentFilter]);

  useEffect(() => {
    void fetchConversations();
  }, [fetchConversations]);

  // Real-time updates via WebSocket
  useEffect(() => {
    const handleUpdate = (data: { conversationId: string; lastMessage?: string; status?: string; updatedAt: string }) => {
      setConversations((prev) => {
        const existing = prev.find((c) => c.id === data.conversationId);
        if (!existing) {
          void fetchConversations();
          return prev;
        }
        const updated = {
          ...existing,
          lastMessageAt: data.updatedAt,
          status: (data.status as ConversationItem['status']) ?? existing.status,
          lastMessage: data.lastMessage
            ? { content: data.lastMessage, role: 'assistant' }
            : existing.lastMessage,
        };
        return [updated, ...prev.filter((c) => c.id !== data.conversationId)];
      });
    };

    on('conversation:update', handleUpdate);
    return () => off('conversation:update', handleUpdate);
  }, [on, off, fetchConversations]);

  const displayName = (conv: ConversationItem): string => {
    if (conv.contact?.name) return conv.contact.name;
    if (conv.contact?.phone) return conv.contact.phone;
    if (conv.contact?.email) return conv.contact.email ?? '';
    return `Conversation ${conv.id.slice(0, 8)}`;
  };

  const STATUS_CONFIG: Record<string, { label: string; variant: 'success' | 'warning' | 'neutral' | 'info' | 'danger' }> = {
    active: { label: t('conversations.filters.active'), variant: 'success' },
    human_takeover: { label: t('conversations.filters.takeover'), variant: 'warning' },
    closed: { label: t('conversations.filters.closed'), variant: 'neutral' },
  };

  // Delete single conversation
  async function handleDelete(id: string) {
    setDeleting(true);
    try {
      await api.delete(`/api/conversations/${id}`);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      setTotal((n) => Math.max(0, n - 1));
      setSelected((prev) => { const next = new Set(prev); next.delete(id); return next; });
    } catch (err) {
      console.error('[conversations] Delete failed:', err);
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  // Bulk delete
  async function handleBulkDelete() {
    setDeleting(true);
    try {
      const ids = Array.from(selected);
      await api.delete('/api/conversations/bulk', { conversationIds: ids });
      setConversations((prev) => prev.filter((c) => !selected.has(c.id)));
      setTotal((n) => Math.max(0, n - ids.length));
      setSelected(new Set());
    } catch (err) {
      console.error('[conversations] Bulk delete failed:', err);
    } finally {
      setDeleting(false);
      setBulkDeleteOpen(false);
    }
  }

  function toggleSelect(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === conversations.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(conversations.map((c) => c.id)));
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.pageTitle}>
          <h1>{t('conversations.title')}</h1>
          <span className={styles.totalBadge}>{total}</span>
        </div>
        <div className={styles.headerActions}>
          {selected.size > 0 && (
            <Button
              variant="danger"
              size="sm"
              icon={Trash2}
              onClick={() => setBulkDeleteOpen(true)}
            >
              {t('conversations.deleteSelected')} ({selected.size})
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            icon={RefreshCw}
            onClick={() => void fetchConversations()}
          >
            {t('conversations.refresh')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={t('conversations.search')}
          className={styles.searchInput}
        />
        <div className={styles.filterGroup}>
          <Filter size={14} aria-hidden="true" />
          <select
            className={styles.select}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label={t('conversations.allStatuses')}
          >
            <option value="">{t('conversations.allStatuses')}</option>
            <option value="active">{t('conversations.filters.active')}</option>
            <option value="human_takeover">{t('conversations.filters.takeover')}</option>
            <option value="closed">{t('conversations.filters.closed')}</option>
          </select>
          <select
            className={styles.select}
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            aria-label={t('conversations.allChannels')}
          >
            <option value="">{t('conversations.allChannels')}</option>
            <option value="web">Web</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
          <select
            className={styles.select}
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
            aria-label={t('conversations.allAgents')}
          >
            <option value="">{t('conversations.allAgents')}</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Bulk select bar */}
      {conversations.length > 0 && (
        <div className={styles.selectBar}>
          <label className={styles.selectAllLabel}>
            <input
              type="checkbox"
              checked={selected.size === conversations.length && conversations.length > 0}
              onChange={toggleSelectAll}
              className={styles.checkbox}
            />
            {t('common.all')}
          </label>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className={styles.loadingState}>
          <Spinner size="lg" />
        </div>
      ) : conversations.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title={t('conversations.empty.title')}
          description={t('conversations.empty.description')}
        />
      ) : (
        <div className={styles.list}>
          {conversations.map((conv) => {
            const statusCfg = STATUS_CONFIG[conv.status] ?? STATUS_CONFIG['active']!;
            const recent = isRecentlyActive(conv.lastMessageAt);
            const help = needsHelp(conv.status);
            return (
              <div key={conv.id} className={styles.itemWrapper}>
                <div
                  className={styles.checkboxCell}
                  onClick={(e) => toggleSelect(conv.id, e)}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(conv.id)}
                    readOnly
                    className={styles.checkbox}
                  />
                </div>
                <Link
                  href={`/dashboard/conversations/${conv.id}`}
                  className={styles.item}
                >
                  <div className={styles.itemAvatar}>
                    <Avatar
                      name={displayName(conv)}
                      size="md"
                      src={conv.contact?.avatarUrl ?? undefined}
                    />
                    {recent && <span className={styles.liveDot} title={t('conversations.live')} />}
                  </div>

                  <div className={styles.itemContent}>
                    <div className={styles.itemHeader}>
                      <span className={styles.itemName}>{displayName(conv)}</span>
                      <span className={styles.itemTime}>
                        {formatRelativeTime(conv.lastMessageAt ?? conv.createdAt, language)}
                      </span>
                    </div>

                    <div className={styles.itemPreview}>
                      <span className={styles.itemMessage}>
                        {conv.lastMessage?.content ?? t('conversations.noMessages')}
                      </span>
                    </div>

                    <div className={styles.itemMeta}>
                      <span className={styles.agentLabel}>{conv.agentName}</span>

                      {conv.channel === 'web' ? (
                        <span className={styles.channelBadge} title="Web">
                          <Globe size={11} aria-hidden="true" /> Web
                        </span>
                      ) : (
                        <span className={`${styles.channelBadge} ${styles.whatsapp}`} title="WhatsApp">
                          <Phone size={11} aria-hidden="true" /> WhatsApp
                        </span>
                      )}

                      <Badge variant={statusCfg.variant} size="sm">
                        {statusCfg.label}
                      </Badge>

                      {help && (
                        <span className={styles.needsHelp}>
                          <UserRound size={12} aria-hidden="true" />
                          {t('conversations.needsHelp')}
                        </span>
                      )}

                      {conv.aiScore !== null && (
                        <span className={styles.score}>{t('conversations.score')} {conv.aiScore}</span>
                      )}
                    </div>
                  </div>
                </Link>
                <button
                  className={styles.deleteBtn}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteTarget(conv.id); }}
                  aria-label={t('common.delete')}
                  type="button"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Single delete confirmation modal */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={t('common.delete')}>
        <p>{t('conversations.deleteConfirm')}</p>
        <div className={styles.modalActions}>
          <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => deleteTarget && void handleDelete(deleteTarget)}
            disabled={deleting}
          >
            {deleting ? t('common.loading') : t('common.delete')}
          </Button>
        </div>
      </Modal>

      {/* Bulk delete confirmation modal */}
      <Modal isOpen={bulkDeleteOpen} onClose={() => setBulkDeleteOpen(false)} title={t('conversations.deleteSelected')}>
        <p>{t('conversations.bulkDeleteConfirm').replace('{count}', String(selected.size))}</p>
        <div className={styles.modalActions}>
          <Button variant="ghost" size="sm" onClick={() => setBulkDeleteOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => void handleBulkDelete()}
            disabled={deleting}
          >
            {deleting ? t('common.loading') : t('common.delete')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
