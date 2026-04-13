'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Send, X, Bot, Paperclip, Mic, Square } from 'lucide-react';
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
  show_branding: boolean;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'human';
  content: string;
  created_at?: string;
  imagePreview?: string;  // data URI for local image preview
  metadata?: {
    media?: {
      type: 'image' | 'video' | 'document';
      url: string;
      caption?: string | null;
    };
  };
}

const SESSION_KEY_PREFIX = 'gs_widget_session_';
const MESSAGES_KEY_PREFIX = 'gs_widget_msgs_';

function renderMarkdown(text: string): string {
  // Escape HTML first to prevent XSS
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Headings: ### or ## at start of line
  html = html.replace(/^#{2,3}\s+(.+)$/gm, '<strong style="display:block;margin:8px 0 4px">$1</strong>');

  // Bold: **text**
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Italic: *text* (but not inside bold which is already converted)
  html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');

  // Inline code: `code`
  html = html.replace(/`([^`]+)`/g, '<code style="background:rgba(0,0,0,.06);padding:1px 4px;border-radius:3px;font-size:0.9em">$1</code>');

  // Line breaks
  html = html.replace(/\n/g, '<br/>');

  return html;
}

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

  const [pendingImage, setPendingImage] = useState<{
    data: string;
    mimeType: string;
    preview: string;
    fileName: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
          // Validate that the session still exists in the backend before resuming
          let sessionValid = false;
          try {
            const validateRes = await fetch(
              `${API_BASE}/api/widget/${agentId}/messages?sessionId=${storedSession}&after=${encodeURIComponent(new Date(0).toISOString())}`,
              { signal: AbortSignal.timeout(5000) }
            );
            sessionValid = validateRes.status !== 404;
          } catch {
            // Network error — assume valid to avoid losing session on transient failures
            sessionValid = true;
          }

          if (sessionValid) {
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
            // Session was deleted — clear stale data and start fresh
            localStorage.removeItem(SESSION_KEY_PREFIX + agentId);
            localStorage.removeItem(MESSAGES_KEY_PREFIX + agentId);
            const welcomeMsg: ChatMessage = {
              id: 'welcome',
              role: 'assistant',
              content: cfg.welcome_message,
              created_at: new Date(0).toISOString(),
            };
            setMessages([welcomeMsg]);
          }
        } else {
          // No session yet — show welcome message from config, defer session creation to first message
          const welcomeMsg: ChatMessage = {
            id: 'welcome',
            role: 'assistant',
            content: cfg.welcome_message,
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

  // Reset stale session — clears localStorage and state so next message creates a fresh session
  const resetSession = useCallback((cfg?: WidgetConfig | null) => {
    localStorage.removeItem(SESSION_KEY_PREFIX + agentId);
    localStorage.removeItem(MESSAGES_KEY_PREFIX + agentId);
    setSessionId(null);
    setPendingCount(0);
    const welcome = cfg?.welcome_message ?? config?.welcome_message ?? 'Hello! How can I help you?';
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: welcome,
      created_at: new Date(0).toISOString(),
    }]);
    setLastMessageTime(new Date(0).toISOString());
  }, [agentId, config]);

  // Poll for new assistant messages
  const pollMessages = useCallback(async (sid: string, after: string) => {
    try {
      const res = await fetch(
        `${API_BASE}/api/widget/${agentId}/messages?sessionId=${sid}&after=${encodeURIComponent(after)}`,
        { signal: AbortSignal.timeout(35000) }
      );

      // Session was deleted — reset so next message creates a new one
      if (res.status === 404) {
        resetSession();
        return;
      }

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
  }, [agentId, resetSession]);

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

  // Cleanup MediaRecorder on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      alert('Only JPEG, PNG, WebP, and GIF images are supported.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Image is too large. Maximum size is 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUri = reader.result as string;
      const base64Data = dataUri.split(',')[1] ?? '';
      setPendingImage({
        data: base64Data,
        mimeType: file.type,
        preview: dataUri,
        fileName: file.name,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  function handleRemoveImage() {
    setPendingImage(null);
  }

  async function handleStartRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Determine supported mimeType
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4'; // Safari fallback

      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        // Stop all tracks to release mic
        stream.getTracks().forEach((track) => track.stop());

        // Clear timer
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

        // Validate size (10MB max)
        if (audioBlob.size > 10 * 1024 * 1024) {
          alert('Recording is too long. Maximum audio size is 10MB.');
          setRecordingDuration(0);
          return;
        }

        // Convert to base64 and send
        const reader = new FileReader();
        reader.onload = () => {
          const dataUri = reader.result as string;
          const base64Data = dataUri.split(',')[1] ?? '';
          sendAudioMessage(base64Data, mimeType);
        };
        reader.readAsDataURL(audioBlob);

        setRecordingDuration(0);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);

      // Duration timer
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((d) => {
          // Auto-stop after 2 minutes
          if (d >= 120) {
            handleStopRecording();
            return d;
          }
          return d + 1;
        });
      }, 1000);
    } catch (err) {
      console.error('[widget] Mic access denied:', err);
      alert('Microphone access is required to send voice messages.');
    }
  }

  function handleStopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }

  function sendAudioMessage(base64Audio: string, mimeType: string) {
    // Show user message immediately
    setMessages((prev) => [...prev, {
      id: `user-${Date.now()}`,
      role: 'user',
      content: '\uD83C\uDFA4 Voice message',
      created_at: new Date().toISOString(),
    }]);

    setLastMessageTime(new Date().toISOString());

    void (async () => {
      const sid = await ensureSession();
      if (!sid) return;

      try {
        const r = await fetch(`${API_BASE}/api/widget/${agentId}/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: sid,
            audio: base64Audio,
            audioMimeType: mimeType,
          }),
        });
        if (r.ok) {
          const data = await r.json() as { conversationStatus?: string };
          if (data.conversationStatus !== 'human_takeover') {
            setPendingCount((n) => n + 1);
            setTimeout(() => setPendingCount((n) => Math.max(0, n - 1)), 30000);
          }
        }
      } catch {
        // Send failed
      }
    })();
  }

  function formatRecordingTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  async function ensureSession(): Promise<string | null> {
    if (sessionId) return sessionId;
    try {
      const sessRes = await fetch(`${API_BASE}/api/widget/${agentId}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referrer: document.referrer.slice(0, 500),
          userAgent: navigator.userAgent.slice(0, 200),
        }),
      });
      if (!sessRes.ok) return null;
      const sess = await sessRes.json() as { sessionId: string };
      setSessionId(sess.sessionId);
      localStorage.setItem(SESSION_KEY_PREFIX + agentId, sess.sessionId);
      return sess.sessionId;
    } catch {
      return null;
    }
  }

  function handleSend() {
    const text = input.trim();
    if (!text && !pendingImage) return;

    // 1. Show user message immediately (with image preview if present)
    const displayContent = pendingImage
      ? (text ? `[Image: ${pendingImage.fileName}]\n${text}` : `[Image: ${pendingImage.fileName}]`)
      : text;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: displayContent,
      created_at: new Date().toISOString(),
      imagePreview: pendingImage?.preview,
    };

    setMessages((prev) => [...prev, userMsg]);

    // 2. Clear input and image
    setInput('');
    const imageToSend = pendingImage;
    setPendingImage(null);
    inputRef.current?.focus();

    // 3. Send message (create session first if needed)
    setLastMessageTime(new Date().toISOString());

    void (async () => {
      const sid = await ensureSession();
      if (!sid) return;

      const body: Record<string, string> = { sessionId: sid };
      if (text) body['message'] = text;
      if (imageToSend) {
        body['image'] = imageToSend.data;
        body['imageMimeType'] = imageToSend.mimeType;
      }

      try {
        const r = await fetch(`${API_BASE}/api/widget/${agentId}/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (r.ok) {
          const data = await r.json() as { messageId: string | null; status: string; conversationStatus?: string; sessionId?: string };
          // Store sessionId if returned from backend (first message fallback)
          if (data.sessionId && !sessionId) {
            setSessionId(data.sessionId);
            localStorage.setItem(SESSION_KEY_PREFIX + agentId, data.sessionId);
          }
          if (data.conversationStatus !== 'human_takeover') {
            setPendingCount((n) => n + 1);
            setTimeout(() => {
              setPendingCount((n) => Math.max(0, n - 1));
            }, 30000);
          }
        }
      } catch {
        // POST failed
      }
    })();
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
              {msg.imagePreview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={msg.imagePreview}
                  alt="Uploaded image"
                  className={styles.messageImage}
                  onClick={() => window.open(msg.imagePreview, '_blank')}
                />
              )}
              {msg.metadata?.media && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: '260px' }}>
                  {msg.metadata.media.type === 'image' && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={msg.metadata.media.url}
                      alt={msg.metadata.media.caption ?? 'Image'}
                      style={{ borderRadius: '10px', maxWidth: '100%', height: 'auto', display: 'block' }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  )}
                  {msg.metadata.media.type === 'document' && (
                    <a
                      href={msg.metadata.media.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '10px 14px',
                        background: 'rgba(0,0,0,0.08)',
                        borderRadius: '10px',
                        color: 'inherit',
                        textDecoration: 'none',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                      }}
                    >
                      📄 View document
                    </a>
                  )}
                  {msg.metadata.media.type === 'video' && (
                    <video
                      src={msg.metadata.media.url}
                      controls
                      style={{ borderRadius: '10px', maxWidth: '100%', display: 'block', background: '#000' }}
                    />
                  )}
                  {msg.metadata.media.caption && (
                    <span style={{ fontSize: '0.8125rem', lineHeight: 1.4 }}>{msg.metadata.media.caption}</span>
                  )}
                </div>
              )}
              {msg.content && !msg.content.startsWith('[Image:') ? (
                msg.role === 'user' ? (
                  <span>{msg.content}</span>
                ) : (
                  <span dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                )
              ) : msg.content && msg.content.includes('\n') ? (
                msg.role === 'user' ? (
                  <span>{msg.content.split('\n').slice(1).join('\n')}</span>
                ) : (
                  <span dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content.split('\n').slice(1).join('\n')) }} />
                )
              ) : !msg.imagePreview ? (
                msg.role === 'user' ? (
                  <span>{msg.content}</span>
                ) : (
                  <span dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                )
              ) : null}
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
        {isRecording && (
          <div className={styles.recordingStrip}>
            <div className={styles.recordingDot} />
            <span className={styles.recordingTime}>{formatRecordingTime(recordingDuration)}</span>
            <span className={styles.recordingLabel}>Recording...</span>
          </div>
        )}
        {pendingImage && (
          <div className={styles.imagePreviewStrip}>
            <div className={styles.imagePreviewThumb}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pendingImage.preview} alt="Preview" />
              <button
                className={styles.imagePreviewRemove}
                onClick={handleRemoveImage}
                type="button"
                aria-label="Remove image"
              >
                <X size={12} />
              </button>
            </div>
          </div>
        )}
        <div className={styles.inputRow}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleImageSelect}
            style={{ display: 'none' }}
          />
          <button
            className={styles.attachBtn}
            onClick={() => fileInputRef.current?.click()}
            disabled={!!pendingImage || isRecording}
            aria-label="Attach image"
            type="button"
          >
            <Paperclip size={18} />
          </button>
          <button
            className={`${styles.attachBtn} ${isRecording ? styles.recordingBtn : ''}`}
            onClick={isRecording ? handleStopRecording : handleStartRecording}
            disabled={!!pendingImage}
            aria-label={isRecording ? 'Stop recording' : 'Record voice message'}
            type="button"
          >
            {isRecording ? <Square size={16} /> : <Mic size={18} />}
          </button>
          <input
            ref={inputRef}
            className={styles.input}
            type="text"
            placeholder="Type a message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={4000}
            autoComplete="off"
          />
          <button
            className={styles.sendBtn}
            onClick={handleSend}
            disabled={(!input.trim() && !pendingImage) || isRecording}
            aria-label="Send message"
            type="button"
            style={{ backgroundColor: config.primary_color }}
          >
            <Send size={16} />
          </button>
        </div>
      </div>

      {/* Footer — branding shown on Free plan only */}
      {config.show_branding && (
        <div className={styles.footer}>
          Powered by{' '}
          <a
            href="https://www.gensmart.co?ref=widget"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.footerLink}
          >
            GenSmart
          </a>
        </div>
      )}
    </div>
  );
}
