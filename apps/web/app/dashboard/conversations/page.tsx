'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  MessageSquare,
  Globe,
  Phone,
  Filter,
  RefreshCw,
} from 'lucide-react';
import { api } from '@/lib/api';
import Badge from '@/components/ui/Badge';
import Avatar from '@/components/ui/Avatar';
import SearchInput from '@/components/ui/SearchInput';
import EmptyState from '@/components/ui/EmptyState';
import Spinner from '@/components/ui/Spinner';
import Button from '@/components/ui/Button';
import { useWebSocket } from '@/hooks/useWebSocket';
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

function timeAgo(isoString: string | null): string {
  if (!isoString) return '';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'success' | 'warning' | 'neutral' | 'info' | 'danger' }> = {
  active: { label: 'Active', variant: 'success' },
  human_takeover: { label: 'Takeover', variant: 'warning' },
  closed: { label: 'Closed', variant: 'neutral' },
};

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [total, setTotal] = useState(0);
  const { on, off } = useWebSocket();

  const fetchConversations = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (channelFilter) params.set('channel', channelFilter);

      const data = await api.get<ConversationsResponse>(`/api/conversations?${params}`);
      setConversations(data.conversations);
      setTotal(data.pagination.total);
    } catch (err) {
      console.error('[conversations] Fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, channelFilter]);

  useEffect(() => {
    void fetchConversations();
  }, [fetchConversations]);

  // Real-time updates via WebSocket
  useEffect(() => {
    const handleUpdate = (data: { conversationId: string; lastMessage?: string; status?: string; updatedAt: string }) => {
      setConversations((prev) => {
        const existing = prev.find((c) => c.id === data.conversationId);
        if (!existing) {
          // New conversation — refresh
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
        // Move to top
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

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.pageTitle}>
          <h1>Conversations</h1>
          <span className={styles.totalBadge}>{total}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          icon={RefreshCw}
          onClick={() => void fetchConversations()}
        >
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by name, phone, email..."
          className={styles.searchInput}
        />
        <div className={styles.filterGroup}>
          <Filter size={14} aria-hidden="true" />
          <select
            className={styles.select}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="human_takeover">Takeover</option>
            <option value="closed">Closed</option>
          </select>
          <select
            className={styles.select}
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            aria-label="Filter by channel"
          >
            <option value="">All channels</option>
            <option value="web">Web</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className={styles.loadingState}>
          <Spinner size="lg" />
        </div>
      ) : conversations.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No conversations yet"
          description="Conversations will appear here once users start chatting with your agents."
        />
      ) : (
        <div className={styles.list}>
          {conversations.map((conv) => {
            const statusCfg = STATUS_CONFIG[conv.status] ?? STATUS_CONFIG['active']!;
            return (
              <Link
                key={conv.id}
                href={`/dashboard/conversations/${conv.id}`}
                className={styles.item}
              >
                <div className={styles.itemAvatar}>
                  <Avatar
                    name={displayName(conv)}
                    size="md"
                    src={conv.contact?.avatarUrl ?? undefined}
                  />
                </div>

                <div className={styles.itemContent}>
                  <div className={styles.itemHeader}>
                    <span className={styles.itemName}>{displayName(conv)}</span>
                    <span className={styles.itemTime}>
                      {timeAgo(conv.lastMessageAt ?? conv.createdAt)}
                    </span>
                  </div>

                  <div className={styles.itemPreview}>
                    <span className={styles.itemMessage}>
                      {conv.lastMessage?.content ?? 'No messages yet'}
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

                    {conv.aiScore !== null && (
                      <span className={styles.score}>Score: {conv.aiScore}</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
