'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Send,
  X,
  Globe,
  Phone,
  MoreHorizontal,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useWebSocket } from '@/hooks/useWebSocket';
import MessageBubble from '@/components/conversations/MessageBubble';
import TakeoverBanner from '@/components/conversations/TakeoverBanner';
import VariablesSidebar from '@/components/conversations/VariablesSidebar';
import Button from '@/components/ui/Button';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { PLAN_LIMITS } from '@gensmart/shared';
import styles from './chat.module.css';

type PlanKey = keyof typeof PLAN_LIMITS;

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'human' | 'system';
  content: string;
  metadata: {
    tokensUsed?: number;
    latencyMs?: number;
    toolsCalled?: string[];
    type?: string;
    error?: boolean;
  };
  createdAt: string;
}

interface ConversationDetail {
  id: string;
  agentId: string;
  agentName: string;
  contact: {
    id: string;
    name: string | null;
    phone: string | null;
    email: string | null;
    avatarUrl: string | null;
    aiScore: number | null;
    funnelStage: string | null;
    customVariables: Record<string, unknown>;
  } | null;
  channel: 'web' | 'whatsapp';
  status: 'active' | 'human_takeover' | 'closed';
  takenOverBy: string | null;
  takeoverUserName: string | null;
  takenOverAt: string | null;
  aiScore: number | null;
  capturedVariables: Record<string, unknown>;
  messageCount: number;
  lastMessageAt: string | null;
  createdAt: string;
}

interface OrgData {
  organization: { plan: string };
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'neutral'> = {
  active: 'success',
  human_takeover: 'warning',
  closed: 'neutral',
};

export default function ConversationDetailPage() {
  const { id: conversationId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { error: showError, success: showSuccess } = useToast();
  const { on, off, joinConversation, leaveConversation } = useWebSocket();

  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendLoading, setSendLoading] = useState(false);
  const [takeoverLoading, setTakeoverLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [orgPlan, setOrgPlan] = useState<string>('free');
  const [detailsOpen, setDetailsOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const fetchConversation = useCallback(async () => {
    if (!conversationId) return;
    try {
      const data = await api.get<{
        conversation: ConversationDetail;
        messages: Message[];
      }>(`/api/conversations/${conversationId}`);
      setConversation(data.conversation);
      setMessages(data.messages);
    } catch (err) {
      console.error('[chat] Fetch failed:', err);
      showError('Failed to load conversation');
    } finally {
      setLoading(false);
    }
  }, [conversationId, showError]);

  const fetchOrgPlan = useCallback(async () => {
    try {
      const data = await api.get<OrgData>('/api/organization');
      setOrgPlan(data.organization.plan);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void fetchConversation();
    void fetchOrgPlan();
  }, [fetchConversation, fetchOrgPlan]);

  useEffect(() => {
    if (!conversationId) return;
    joinConversation(conversationId);
    return () => leaveConversation(conversationId);
  }, [conversationId, joinConversation, leaveConversation]);

  // Scroll to bottom when messages load
  useEffect(() => {
    if (!loading) scrollToBottom();
  }, [loading, scrollToBottom]);

  // WebSocket: new messages
  useEffect(() => {
    const handleNewMessages = (data: {
      conversationId: string;
      messages?: Array<{
        id?: string;
        role: string;
        content: string;
        metadata?: Record<string, unknown>;
        createdAt?: string;
      }>;
      role?: string;
      content?: string;
    }) => {
      if (data.conversationId !== conversationId) return;

      if (data.messages) {
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const newOnes = data.messages!
            .filter((m) => m.id && !existingIds.has(m.id))
            .map((m) => ({
              id: m.id!,
              role: m.role as Message['role'],
              content: m.content,
              metadata: (m.metadata ?? {}) as Message['metadata'],
              createdAt: m.createdAt ?? new Date().toISOString(),
            }));
          if (!newOnes.length) return prev;
          return [...prev, ...newOnes];
        });
      }
      setTimeout(scrollToBottom, 100);
    };

    on('message:new', handleNewMessages);
    return () => off('message:new', handleNewMessages);
  }, [on, off, conversationId, scrollToBottom]);

  // WebSocket: variable updates
  useEffect(() => {
    const handleVarUpdate = (data: { conversationId: string; variables: Record<string, unknown> }) => {
      if (data.conversationId !== conversationId) return;
      setConversation((prev) =>
        prev ? { ...prev, capturedVariables: data.variables } : prev
      );
    };

    on('variables:update', handleVarUpdate);
    return () => off('variables:update', handleVarUpdate);
  }, [on, off, conversationId]);

  // WebSocket: takeover status
  useEffect(() => {
    const handleTakeover = (data: {
      conversationId: string;
      status: string;
      userId: string | null;
      userName?: string;
    }) => {
      if (data.conversationId !== conversationId) return;
      setConversation((prev) =>
        prev
          ? {
              ...prev,
              status: data.status as ConversationDetail['status'],
              takenOverBy: data.userId,
              takeoverUserName: data.userName ?? null,
            }
          : prev
      );
    };

    on('takeover:status', handleTakeover);
    return () => off('takeover:status', handleTakeover);
  }, [on, off, conversationId]);

  const handleTakeover = async () => {
    if (!conversation) return;
    setTakeoverLoading(true);
    try {
      await api.post(`/api/conversations/${conversationId}/takeover`);
      setConversation((prev) =>
        prev
          ? {
              ...prev,
              status: 'human_takeover',
              takenOverBy: user?.id ?? null,
              takeoverUserName: user?.name ?? null,
            }
          : prev
      );
      showSuccess('You are now in control of this conversation');
    } catch (err) {
      showError((err as Error).message);
    } finally {
      setTakeoverLoading(false);
    }
  };

  const handleRelease = async () => {
    if (!conversation) return;
    setTakeoverLoading(true);
    try {
      await api.post(`/api/conversations/${conversationId}/release`);
      setConversation((prev) =>
        prev
          ? { ...prev, status: 'active', takenOverBy: null, takeoverUserName: null }
          : prev
      );
      showSuccess('Conversation released to AI agent');
    } catch (err) {
      showError((err as Error).message);
    } finally {
      setTakeoverLoading(false);
    }
  };

  const handleSendMessage = async () => {
    const content = inputValue.trim();
    if (!content || sendLoading) return;

    setSendLoading(true);
    setInputValue('');

    // Optimistically add the message
    const optimisticMsg: Message = {
      id: `tmp-${Date.now()}`,
      role: 'human',
      content,
      metadata: {},
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setTimeout(scrollToBottom, 50);

    try {
      await api.post(`/api/conversations/${conversationId}/message`, { content });
    } catch (err) {
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
      showError((err as Error).message);
      setInputValue(content);
    } finally {
      setSendLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSendMessage();
    }
  };

  const handleCloseConversation = async () => {
    if (!conversation) return;
    try {
      await api.put(`/api/conversations/${conversationId}/close`);
      setConversation((prev) => (prev ? { ...prev, status: 'closed' } : prev));
      showSuccess('Conversation closed');
    } catch (err) {
      showError((err as Error).message);
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingPage}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className={styles.loadingPage}>
        <p>Conversation not found.</p>
        <Link href="/dashboard/conversations">Back to conversations</Link>
      </div>
    );
  }

  const planLimits = PLAN_LIMITS[orgPlan as PlanKey];
  const canTakeover = planLimits?.humanTakeover ?? false;
  const isTakenOverByMe =
    conversation.status === 'human_takeover' &&
    conversation.takenOverBy === user?.id;
  const canSendMessage = isTakenOverByMe;

  const displayName = conversation.contact?.name
    ?? conversation.contact?.phone
    ?? conversation.contact?.email
    ?? `Conversation ${conversation.id.slice(0, 8)}`;

  return (
    <div className={styles.page}>
      {/* Back button (mobile) */}
      <div className={styles.mobileBack}>
        <Link href="/dashboard/conversations" className={styles.backLink}>
          <ArrowLeft size={16} aria-hidden="true" /> Conversations
        </Link>
      </div>

      <div className={styles.layout}>
        {/* Chat area */}
        <div className={styles.chatArea}>
          {/* Chat header */}
          <div className={styles.chatHeader}>
            <div className={styles.chatHeaderLeft}>
              <Avatar
                name={displayName}
                size="sm"
                src={conversation.contact?.avatarUrl ?? undefined}
              />
              <div className={styles.chatHeaderInfo}>
                <span className={styles.chatName}>{displayName}</span>
                <div className={styles.chatMeta}>
                  {conversation.channel === 'web' ? (
                    <span className={styles.channelTag}>
                      <Globe size={10} aria-hidden="true" /> Web
                    </span>
                  ) : (
                    <span className={`${styles.channelTag} ${styles.whatsapp}`}>
                      <Phone size={10} aria-hidden="true" /> WhatsApp
                    </span>
                  )}
                  <Badge
                    variant={STATUS_VARIANT[conversation.status] ?? 'neutral'}
                    size="sm"
                  >
                    {conversation.status === 'human_takeover' ? 'Takeover' : conversation.status}
                  </Badge>
                  <span className={styles.agentTag}>{conversation.agentName}</span>
                </div>
              </div>
            </div>
            <div className={styles.chatHeaderRight}>
              {conversation.status !== 'closed' && (
                <button
                  className={styles.iconBtn}
                  onClick={handleCloseConversation}
                  title="Close conversation"
                  aria-label="Close conversation"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              )}
              <button
                className={`${styles.iconBtn} ${styles.detailsToggle}`}
                onClick={() => setDetailsOpen((v) => !v)}
                title="Toggle details"
                aria-label="Toggle contact details"
              >
                <MoreHorizontal size={16} aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Takeover banner */}
          <TakeoverBanner
            status={conversation.status}
            takenOverBy={conversation.takenOverBy}
            takeoverUserName={conversation.takeoverUserName}
            currentUserId={user?.id ?? ''}
            canTakeover={canTakeover}
            onTakeover={() => void handleTakeover()}
            onRelease={() => void handleRelease()}
            loading={takeoverLoading}
          />

          {/* Messages */}
          <div className={styles.messages}>
            {messages.length === 0 ? (
              <div className={styles.emptyMessages}>
                <p>No messages yet in this conversation.</p>
              </div>
            ) : (
              messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  role={msg.role}
                  content={msg.content}
                  createdAt={msg.createdAt}
                  metadata={msg.metadata}
                />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          {conversation.status !== 'closed' && (
            <div className={styles.inputArea}>
              {canSendMessage ? (
                <div className={styles.inputRow}>
                  <textarea
                    ref={textareaRef}
                    className={styles.textarea}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
                    rows={2}
                    disabled={sendLoading}
                    aria-label="Message input"
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    icon={Send}
                    iconPosition="right"
                    onClick={() => void handleSendMessage()}
                    loading={sendLoading}
                    disabled={!inputValue.trim()}
                    aria-label="Send message"
                  >
                    Send
                  </Button>
                </div>
              ) : (
                <div className={styles.inputDisabled}>
                  {conversation.status === 'human_takeover' && conversation.takenOverBy !== user?.id
                    ? `Taken over by ${conversation.takeoverUserName ?? 'another agent'}`
                    : 'Take over this conversation to send messages'}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Details sidebar */}
        <div className={[styles.details, detailsOpen ? styles.detailsOpen : ''].join(' ')}>
          <VariablesSidebar
            capturedVariables={conversation.capturedVariables}
            contact={conversation.contact}
          />
        </div>
      </div>
    </div>
  );
}
