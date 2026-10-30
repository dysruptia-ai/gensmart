'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useWebSocket, type WebSocketEvents } from '@/hooks/useWebSocket';
import { useTranslation } from '@/hooks/useTranslation';

interface ConversationAlertsValue {
  /** Conversations with an unseen customer message plus those asking for a human. */
  count: number;
  /** True when at least one conversation is waiting for human help. */
  hasUrgent: boolean;
  /** Notification permission is still undecided, so the opt-in prompt should be shown. */
  canAskPermission: boolean;
  /** Must be called from a click: asks for notification permission and unlocks audio. */
  enableAlerts: () => Promise<void>;
}

const ConversationAlertsContext = createContext<ConversationAlertsValue | null>(null);

const CONVERSATION_PATH = /^\/dashboard\/conversations\/([^/?#]+)/;
const FAVICON_SIZE = 32;

function conversationIdFromPath(pathname: string): string | null {
  return CONVERSATION_PATH.exec(pathname)?.[1] ?? null;
}

function withoutId(set: Set<string>, id: string): Set<string> {
  if (!set.has(id)) return set;
  const next = new Set(set);
  next.delete(id);
  return next;
}

function withId(set: Set<string>, id: string): Set<string> {
  if (set.has(id)) return set;
  return new Set(set).add(id);
}

type MessageNewPayload = Parameters<WebSocketEvents['message:new']>[0];
type NotificationPayload = Parameters<WebSocketEvents['notification:new']>[0];

function customerMessage(data: MessageNewPayload): string | null {
  const fromArray = data.messages?.find((m) => m.role === 'user');
  if (fromArray) return fromArray.content;
  if (data.role === 'user') return data.content ?? '';
  return null;
}

export function ConversationAlertsProvider({ children }: { children: React.ReactNode }) {
  const { on, off } = useWebSocket();
  const { t } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();

  const [unseen, setUnseen] = useState<Set<string>>(new Set());
  const [needsHelp, setNeedsHelp] = useState<Set<string>>(new Set());
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');

  // Handlers are registered once; they read the latest values through refs
  const viewingRef = useRef<string | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const tRef = useRef(t);
  const routerRef = useRef(router);
  tRef.current = t;
  routerRef.current = router;

  useEffect(() => {
    if (typeof Notification !== 'undefined') setPermission(Notification.permission);
  }, []);

  // Opening a conversation marks it as seen
  useEffect(() => {
    const id = conversationIdFromPath(pathname);
    viewingRef.current = id;
    if (!id) return;
    setUnseen((prev) => withoutId(prev, id));
    setNeedsHelp((prev) => withoutId(prev, id));
  }, [pathname]);

  const playSound = useCallback((urgent: boolean) => {
    try {
      const ctx = audioRef.current;
      if (!ctx || ctx.state !== 'running') return;
      const tones = urgent ? [{ freq: 800, at: 0 }, { freq: 1000, at: 0.18 }] : [{ freq: 600, at: 0 }];
      for (const tone of tones) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = ctx.currentTime + tone.at;
        osc.frequency.value = tone.freq;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(urgent ? 0.25 : 0.15, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.15);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.16);
      }
    } catch {
      // Audio is best effort
    }
  }, []);

  const showNotification = useCallback((conversationId: string, title: string, body: string) => {
    try {
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
      const notification = new Notification(title, { body, tag: conversationId });
      notification.onclick = () => {
        window.focus();
        routerRef.current.push(`/dashboard/conversations/${conversationId}`);
        notification.close();
      };
    } catch {
      // Some browsers throw outside a secure context
    }
  }, []);

  useEffect(() => {
    const handleMessage: WebSocketEvents['message:new'] = (data) => {
      const content = customerMessage(data);
      if (content === null || data.conversationId === viewingRef.current) return;
      setUnseen((prev) => withId(prev, data.conversationId));
      showNotification(data.conversationId, tRef.current('conversations.alerts.newMessageTitle'), content.slice(0, 120));
      playSound(false);
    };

    const handleNotification = (data: NotificationPayload) => {
      if (data.type !== 'human_handoff') return;
      const conversationId = data.data?.['conversationId'];
      if (typeof conversationId !== 'string') return;
      const contactName = data.data?.['contactName'];
      setUnseen((prev) => withoutId(prev, conversationId));
      setNeedsHelp((prev) => withId(prev, conversationId));
      showNotification(
        conversationId,
        tRef.current('conversations.alerts.handoffTitle'),
        typeof contactName === 'string' ? contactName : data.title
      );
      playSound(true);
    };

    const handleTakeover: WebSocketEvents['takeover:status'] = (data) => {
      if (data.status === 'human_takeover') {
        setNeedsHelp((prev) => withoutId(prev, data.conversationId));
      }
    };

    on('message:new', handleMessage);
    on('notification:new', handleNotification);
    on('takeover:status', handleTakeover);
    return () => {
      off('message:new', handleMessage);
      off('notification:new', handleNotification);
      off('takeover:status', handleTakeover);
    };
  }, [on, off, playSound, showNotification]);

  const enableAlerts = useCallback(async () => {
    try {
      const Ctor = window.AudioContext;
      if (Ctor) {
        audioRef.current ??= new Ctor();
        await audioRef.current.resume();
      }
    } catch {
      // Sound stays disabled
    }
    try {
      if (typeof Notification !== 'undefined') setPermission(await Notification.requestPermission());
    } catch {
      // Permission prompt unavailable
    }
  }, []);

  // A granted permission from an earlier visit still needs a click to unlock audio: unlock on the first gesture
  useEffect(() => {
    if (permission !== 'granted') return;
    const unlock = () => {
      try {
        const Ctor = window.AudioContext;
        if (!Ctor) return;
        audioRef.current ??= new Ctor();
        void audioRef.current.resume();
      } catch {
        // Sound stays disabled
      }
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, [permission]);

  const count = unseen.size + needsHelp.size;
  const hasUrgent = needsHelp.size > 0;

  // Favicon with a counter (best effort). Next.js renders several <link rel="icon"> (ico + PNG sizes) and the
  // browser may show any of them, so every one is redrawn. Each keeps its own original in data-original-href.
  useEffect(() => {
    const links = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]'));
    let cancelled = false;
    for (const link of links) {
      link.dataset['originalHref'] ??= link.href;
      const originalHref = link.dataset['originalHref'];
      if (count === 0) {
        link.href = originalHref;
        continue;
      }
      const img = new Image();
      img.onload = () => {
        try {
          if (cancelled) return;
          const size = img.naturalWidth || FAVICON_SIZE;
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          ctx.drawImage(img, 0, 0, size, size);
          const radius = size * 0.34;
          const cx = size - radius;
          const cy = radius;
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.fillStyle = hasUrgent ? '#EF4444' : '#25D366';
          ctx.fill();
          ctx.fillStyle = '#FFFFFF';
          ctx.font = `bold ${Math.round(size * 0.47)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(count > 9 ? '9+' : String(count), cx, cy + size * 0.03);
          const dataUrl = canvas.toDataURL('image/png');
          link.type = 'image/png';
          link.href = dataUrl;
        } catch {
          // Tainted canvas or unsupported image: leave this icon untouched
        }
      };
      img.src = originalHref;
    }
    return () => {
      cancelled = true;
    };
  }, [count, hasUrgent]);

  const value = useMemo<ConversationAlertsValue>(
    () => ({ count, hasUrgent, canAskPermission: permission === 'default', enableAlerts }),
    [count, hasUrgent, permission, enableAlerts]
  );

  return <ConversationAlertsContext.Provider value={value}>{children}</ConversationAlertsContext.Provider>;
}

export function useConversationAlerts(): ConversationAlertsValue {
  const ctx = useContext(ConversationAlertsContext);
  if (!ctx) throw new Error('useConversationAlerts must be used within ConversationAlertsProvider');
  return ctx;
}
