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
  Paperclip,
  Mic,
  Square,
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
    hasImages?: boolean;
    imageCount?: number;
    isVoiceMessage?: boolean;
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
  plan: string;
  [key: string]: unknown;
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
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [oldestTimestamp, setOldestTimestamp] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<{ data: string; mimeType: string; preview: string } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const fetchConversation = useCallback(async () => {
    if (!conversationId) return;
    try {
      const data = await api.get<{
        conversation: ConversationDetail;
        messages: Message[];
        pagination: { total: number; hasMore: boolean; oldestTimestamp: string | null };
      }>(`/api/conversations/${conversationId}?msgLimit=50`);
      setConversation(data.conversation);
      setMessages(data.messages);
      setHasMoreMessages(data.pagination.hasMore);
      setOldestTimestamp(data.pagination.oldestTimestamp);
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
      setOrgPlan(data.plan ?? 'free');
    } catch {
      // ignore
    }
  }, []);

  const loadMoreMessages = useCallback(async () => {
    if (!conversationId || !oldestTimestamp || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await api.get<{
        conversation: ConversationDetail;
        messages: Message[];
        pagination: { total: number; hasMore: boolean; oldestTimestamp: string | null };
      }>(`/api/conversations/${conversationId}?msgLimit=50&msgBefore=${oldestTimestamp}`);

      setMessages((prev) => [...data.messages, ...prev]);
      setHasMoreMessages(data.pagination.hasMore);
      setOldestTimestamp(data.pagination.oldestTimestamp);
    } catch (err) {
      console.error('[chat] Load more failed:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [conversationId, oldestTimestamp, loadingMore]);

  useEffect(() => {
    void fetchConversation();
    void fetchOrgPlan();
  }, [fetchConversation, fetchOrgPlan]);

  useEffect(() => {
    if (!conversationId) return;
    joinConversation(conversationId);
    return () => leaveConversation(conversationId);
  }, [conversationId, joinConversation, leaveConversation]);

  // Polling fallback for all active conversations — WebSocket may temporarily disconnect
  useEffect(() => {
    if (!conversationId || conversation?.status === 'closed') return;

    const pollInterval = setInterval(async () => {
      try {
        const data = await api.get<{ conversation: ConversationDetail; messages: Message[]; pagination: { total: number; hasMore: boolean; oldestTimestamp: string | null } }>(
          `/api/conversations/${conversationId}?msgLimit=50`
        );
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          // Track optimistic messages (tmp-*) by content for dedup
          const optimisticContents = new Set(
            prev.filter((m) => m.id.startsWith('tmp-')).map((m) => `${m.role}:${m.content}`)
          );
          const newMsgs = data.messages.filter((m) => {
            if (existingIds.has(m.id)) return false;
            if (optimisticContents.has(`${m.role}:${m.content}`)) return false;
            return true;
          });
          if (!newMsgs.length) return prev;
          // Replace optimistic messages with real ones if they match
          const replaced = prev.map((existing) => {
            if (!existing.id.startsWith('tmp-')) return existing;
            const match = data.messages.find(
              (m) => m.role === existing.role && m.content === existing.content && !existingIds.has(m.id)
            );
            return match ? { ...existing, id: match.id, createdAt: match.createdAt } : existing;
          });
          return [...replaced, ...newMsgs];
        });
        setConversation(data.conversation);
      } catch {
        // ignore polling errors
      }
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [conversationId, conversation?.status]);

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
          const optimisticContents = new Set(
            prev.filter((m) => m.id.startsWith('tmp-')).map((m) => `${m.role}:${m.content}`)
          );
          const newOnes = data.messages!
            .filter((m) => {
              const msgId = m.id || `ws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
              if (!m.id) m.id = msgId;
              if (existingIds.has(msgId)) return false;
              // Skip if matches an optimistic message by content
              if (optimisticContents.has(`${m.role}:${m.content}`)) return false;
              return true;
            })
            .map((m) => ({
              id: m.id || `ws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showError('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showError('Image must be under 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1] ?? '';
      setPendingImage({ data: base64, mimeType: file.type, preview: reader.result as string });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const buffer = await blob.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
        await sendMultimedia(undefined, { data: base64, mimeType: 'audio/webm' });
        setIsRecording(false);
        setRecordingDuration(0);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      recordingTimerRef.current = setInterval(() => setRecordingDuration((d) => d + 1), 1000);
    } catch {
      showError('Could not access microphone');
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
  }

  async function sendMultimedia(
    image?: { data: string; mimeType: string },
    audio?: { data: string; mimeType: string }
  ) {
    setSendLoading(true);
    const content = inputValue.trim();

    const optimisticMsg: Message = {
      id: `tmp-${Date.now()}`,
      role: 'human',
      content: audio ? 'Voice message...' : (content || '[Image]'),
      metadata: {
        ...(image ? { hasImages: true, imageCount: 1 } : {}),
        ...(audio ? { isVoiceMessage: true } : {}),
      },
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setInputValue('');
    setPendingImage(null);
    setTimeout(scrollToBottom, 50);

    try {
      const result = await api.post<{ message: { id: string; role: string; content: string; metadata: Record<string, unknown>; createdAt: string } }>(
        `/api/conversations/${conversationId}/message`,
        { content: content || undefined, image, audio }
      );
      if (result.message) {
        setMessages((prev) => prev.map((m) =>
          m.id === optimisticMsg.id ? { ...m, id: result.message.id, content: result.message.content, metadata: result.message.metadata as Message['metadata'], createdAt: result.message.createdAt } : m
        ));
      }
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
      showError((err as Error).message);
    } finally {
      setSendLoading(false);
    }
  }

  const handleSendMessage = async () => {
    const content = inputValue.trim();
    if ((!content && !pendingImage) || sendLoading) return;

    if (pendingImage) {
      await sendMultimedia({ data: pendingImage.data, mimeType: pendingImage.mimeType });
    } else {
      await sendMultimedia();
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
            {hasMoreMessages && (
              <div className={styles.loadMore}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void loadMoreMessages()}
                  loading={loadingMore}
                >
                  Load earlier messages
                </Button>
              </div>
            )}
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
                <>
                  {pendingImage && (
                    <div className={styles.imagePreviewStrip}>
                      <div className={styles.imagePreviewThumb}>
                        <img src={pendingImage.preview} alt="Preview" />
                        <button className={styles.imagePreviewRemove} onClick={() => setPendingImage(null)}>
                          <X size={10} />
                        </button>
                      </div>
                    </div>
                  )}
                  {isRecording && (
                    <div className={styles.recordingStrip}>
                      <span className={styles.recordingDot} />
                      <span className={styles.recordingTime}>
                        {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
                      </span>
                      <span className={styles.recordingLabel}>Recording...</span>
                    </div>
                  )}
                  <div className={styles.inputRow}>
                    {planLimits?.imageVision && (
                      <>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleImageSelect}
                          style={{ display: 'none' }}
                        />
                        <button
                          className={styles.iconBtn}
                          onClick={() => fileInputRef.current?.click()}
                          title="Attach image"
                          disabled={sendLoading || isRecording}
                        >
                          <Paperclip size={16} />
                        </button>
                      </>
                    )}
                    <textarea
                      ref={textareaRef}
                      className={styles.textarea}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
                      rows={2}
                      disabled={sendLoading || isRecording}
                      aria-label="Message input"
                    />
                    {planLimits?.voiceMessages && !inputValue.trim() && !pendingImage ? (
                      <button
                        className={`${styles.iconBtn} ${isRecording ? styles.recordingBtn : ''}`}
                        onClick={isRecording ? stopRecording : () => void startRecording()}
                        title={isRecording ? 'Stop recording' : 'Record voice message'}
                      >
                        {isRecording ? <Square size={16} /> : <Mic size={16} />}
                      </button>
                    ) : (
                      <Button
                        variant="primary"
                        size="sm"
                        icon={Send}
                        iconPosition="right"
                        onClick={() => void handleSendMessage()}
                        loading={sendLoading}
                        disabled={!inputValue.trim() && !pendingImage}
                        aria-label="Send message"
                      >
                        Send
                      </Button>
                    )}
                  </div>
                </>
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
