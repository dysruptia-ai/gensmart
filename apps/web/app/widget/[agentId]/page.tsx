'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Send, X, Bot } from 'lucide-react';
import styles from './widget.module.css';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? '';

interface WidgetConfig {
  agentId: string;
  name: string;
  avatar_url: string | null;
  avatar_initials: string;
  primary_color: string;
  welcome_message: string;
  bubble_text: string;
  position: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'human';
  content: string;
  created_at?: string;
}

const SESSION_KEY_PREFIX = 'gs_widget_session_';
const MESSAGES_KEY_PREFIX = 'gs_widget_msgs_';

export default function WidgetPage() {
  const params = useParams();
  const agentId = params['agentId'] as string;

  const [config, setConfig] = useState<WidgetConfig | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastMessageTime, setLastMessageTime] = useState<string>(new Date(0).toISOString());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, pendingCount, scrollToBottom]);

  // Load config and init session
  useEffect(() => {
    if (!agentId) return;

    async function init() {
      setIsLoading(true);
      try {
        // Fetch config
        const cfgRes = await fetch(`${API_BASE}/api/widget/${agentId}/config`);
        if (!cfgRes.ok) {
          setError('This chat is currently unavailable.');
          setIsLoading(false);
          return;
        }
        const cfg = await cfgRes.json() as WidgetConfig;
        setConfig(cfg);

        // Apply primary color as CSS variable
        document.documentElement.style.setProperty('--widget-primary', cfg.primary_color);

        // Try to resume existing session from localStorage
        const storedSession = localStorage.getItem(SESSION_KEY_PREFIX + agentId);
        const storedMessages = localStorage.getItem(MESSAGES_KEY_PREFIX + agentId);

        if (storedSession) {
          setSessionId(storedSession);
          if (storedMessages) {
            const parsed = JSON.parse(storedMessages) as ChatMessage[];
            setMessages(parsed);
            if (parsed.length > 0) {
              const last = parsed[parsed.length - 1];
              setLastMessageTime(last.created_at ?? new Date().toISOString());
            }
          } else {
            // Add welcome message for resumed session
            setMessages([{
              id: 'welcome',
              role: 'assistant',
              content: cfg.welcome_message,
              created_at: new Date(0).toISOString(),
            }]);
          }
        } else {
          // Create new session
          const sessRes = await fetch(`${API_BASE}/api/widget/${agentId}/session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              referrer: document.referrer.slice(0, 500),
              userAgent: navigator.userAgent.slice(0, 200),
            }),
          });

          if (!sessRes.ok) {
            setError('Could not start a chat session. Please try again.');
            setIsLoading(false);
            return;
          }

          const sess = await sessRes.json() as { sessionId: string; welcomeMessage: string };
          setSessionId(sess.sessionId);
          localStorage.setItem(SESSION_KEY_PREFIX + agentId, sess.sessionId);

          const welcomeMsg: ChatMessage = {
            id: 'welcome',
            role: 'assistant',
            content: sess.welcomeMessage,
            created_at: new Date(0).toISOString(),
          };
          setMessages([welcomeMsg]);
        }
      } catch {
        setError('Failed to connect to the chat service.');
      } finally {
        setIsLoading(false);
      }
    }

    init();
  }, [agentId]);

  // Persist messages to localStorage
  useEffect(() => {
    if (messages.length > 1 && agentId) {
      localStorage.setItem(MESSAGES_KEY_PREFIX + agentId, JSON.stringify(messages.slice(-50)));
    }
  }, [messages, agentId]);

  // Poll for new assistant messages
  const pollMessages = useCallback(async (sid: string, after: string) => {
    try {
      const res = await fetch(
        `${API_BASE}/api/widget/${agentId}/messages?sessionId=${sid}&after=${encodeURIComponent(after)}`,
        { signal: AbortSignal.timeout(35000) }
      );
      if (!res.ok) return;

      const data = await res.json() as { messages: ChatMessage[] };
      if (data.messages && data.messages.length > 0) {
        setMessages((prev) => {
          const ids = new Set(prev.map((m) => m.id));
          const newMsgs = data.messages.filter((m) => !ids.has(m.id));
          return newMsgs.length > 0 ? [...prev, ...newMsgs] : prev;
        });
        const last = data.messages[data.messages.length - 1];
        setLastMessageTime(last.created_at ?? new Date().toISOString());
        setPendingCount(0);
      }
    } catch {
      // Ignore poll errors — will retry
    }
  }, [agentId]);

  // Start / stop polling based on whether there are pending (unanswered) messages
  const isPending = pendingCount > 0;
  useEffect(() => {
    if (!sessionId || !isPending) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    const poll = () => pollMessages(sessionId, lastMessageTime);
    poll(); // immediate first poll
    pollingRef.current = setInterval(poll, 2500);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [sessionId, isPending, lastMessageTime, pollMessages]);

  // Background polling — catches human takeover messages and delayed responses
  useEffect(() => {
    if (!sessionId) return;

    const bgPoll = setInterval(() => {
      pollMessages(sessionId, lastMessageTime);
    }, 8000);

    return () => clearInterval(bgPoll);
  }, [sessionId, lastMessageTime, pollMessages]);

  function handleSend() {
    const text = input.trim();
    if (!text || !sessionId) return;

    // 1. Show user message immediately
    setMessages((prev) => [...prev, {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    }]);

    // 2. Clear input and keep focus so the user can keep typing
    setInput('');
    inputRef.current?.focus();

    // 3. Send message and conditionally show typing indicator
    setLastMessageTime(new Date().toISOString());

    fetch(`${API_BASE}/api/widget/${agentId}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, message: text }),
    })
      .then(async (r) => {
        if (r.ok) {
          const data = await r.json() as { messageId: string | null; status: string; conversationStatus?: string };
          // Only show typing indicator when AI is handling the conversation
          if (data.conversationStatus !== 'human_takeover') {
            setPendingCount((n) => n + 1);
            // Auto-clear after 30s as safety net
            setTimeout(() => {
              setPendingCount((n) => Math.max(0, n - 1));
            }, 30000);
          }
        }
      })
      .catch(() => {
        // POST failed — no typing indicator needed
      });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleClose() {
    window.parent.postMessage({ type: 'gensmart:close' }, '*');
  }

  function getInitialsAvatar(initials: string, color: string) {
    return (
      <div
        className={styles.avatarInitials}
        style={{ backgroundColor: color }}
        aria-hidden="true"
      >
        {initials.slice(0, 2).toUpperCase()}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadingDots}>
          <span /><span /><span />
        </div>
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className={styles.errorScreen}>
        <Bot size={32} color="#6B7280" aria-hidden="true" />
        <p>{error ?? 'Chat unavailable'}</p>
      </div>
    );
  }

  return (
    <div className={styles.widget} style={{ '--widget-primary': config.primary_color } as React.CSSProperties}>
      {/* Header */}
      <div className={styles.header} style={{ backgroundColor: config.primary_color }}>
        <div className={styles.headerLeft}>
          {config.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={config.avatar_url}
              alt={config.name}
              className={styles.headerAvatar}
            />
          ) : (
            getInitialsAvatar(config.avatar_initials, 'rgba(255,255,255,0.25)')
          )}
          <div className={styles.headerMeta}>
            <span className={styles.headerName}>{config.name}</span>
            <span className={styles.headerStatus}>
              <span className={styles.statusDot} /> Online
            </span>
          </div>
        </div>
        <button
          className={styles.closeBtn}
          onClick={handleClose}
          aria-label="Close chat"
          type="button"
        >
          <X size={18} />
        </button>
      </div>

      {/* Messages */}
      <div className={styles.messages}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={[
              styles.messageRow,
              msg.role === 'user' ? styles.messageRowUser : styles.messageRowAssistant,
            ].join(' ')}
          >
            {msg.role !== 'user' && (
              <div className={styles.msgAvatar}>
                {config.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={config.avatar_url} alt="" className={styles.msgAvatarImg} />
                ) : (
                  getInitialsAvatar(config.avatar_initials, config.primary_color)
                )}
              </div>
            )}
            <div
              className={[
                styles.bubble,
                msg.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant,
              ].join(' ')}
              style={msg.role === 'user' ? { backgroundColor: config.primary_color } : undefined}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {pendingCount > 0 && (
          <div className={[styles.messageRow, styles.messageRowAssistant].join(' ')}>
            <div className={styles.msgAvatar}>
              {config.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={config.avatar_url} alt="" className={styles.msgAvatarImg} />
              ) : (
                getInitialsAvatar(config.avatar_initials, config.primary_color)
              )}
            </div>
            <div className={[styles.bubble, styles.bubbleAssistant, styles.typingBubble].join(' ')}>
              <span className={styles.typingDots}>
                <span /><span /><span />
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className={styles.inputArea}>
        <input
          ref={inputRef}
          className={styles.input}
          type="text"
          placeholder="Type a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!sessionId}
          maxLength={4000}
          autoComplete="off"
        />
        <button
          className={styles.sendBtn}
          onClick={handleSend}
          disabled={!input.trim() || !sessionId}
          aria-label="Send message"
          type="button"
          style={{ backgroundColor: config.primary_color }}
        >
          <Send size={16} />
        </button>
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        Powered by{' '}
        <a
          href="https://gensmart.co"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.footerLink}
        >
          GenSmart
        </a>
      </div>
    </div>
  );
}
