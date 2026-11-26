'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useWebSocket, type WebSocketEvents } from '@/hooks/useWebSocket';
import { useTranslation } from '@/hooks/useTranslation';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { getChannelMeta } from '@/components/app/Inbox/channelMeta';

interface ConversationAlertsValue {
  /**
   * Conversations that need someone: the same number as the Bandeja's "Necesitan a alguien"
   * (`needs` from GET /api/conversations/counts, web-41).
   */
  count: number;
  /** True when at least one conversation needs someone. */
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

/** The counter is refreshed on every conversation event (grouped) and, as a fallback, once a minute. */
const COUNT_DEBOUNCE_MS = 800;
const COUNT_POLL_MS = 60_000;

type MessageNewPayload = Parameters<WebSocketEvents['message:new']>[0];
type NotificationPayload = Parameters<WebSocketEvents['notification:new']>[0];

function capitalizePlan(plan: string): string {
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

function customerMessage(data: MessageNewPayload): string | null {
  const fromArray = data.messages?.find((m) => m.role === 'user');
  if (fromArray) return fromArray.content;
  if (data.role === 'user') return data.content ?? '';
  return null;
}

export function ConversationAlertsProvider({ children }: { children: React.ReactNode }) {
  const { on, off } = useWebSocket();
  const { t } = useTranslation();
  const { warning } = useToast();
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  const [needs, setNeeds] = useState(0);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');

  // Handlers are registered once; they read the latest values through refs
  const viewingRef = useRef<string | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const tRef = useRef(t);
  const routerRef = useRef(router);
  const warningRef = useRef(warning);
  tRef.current = t;
  routerRef.current = router;
  warningRef.current = warning;

  useEffect(() => {
    if (typeof Notification !== 'undefined') setPermission(Notification.permission);
  }, []);

  // The open conversation does not raise a desktop notification
  useEffect(() => {
    viewingRef.current = conversationIdFromPath(pathname);
  }, [pathname]);

  // "Necesitan a alguien" from the API: on load, on events (grouped) and once a minute
  const countTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadCount = useCallback(() => {
    api
      .get<{ needs: number }>('/api/conversations/counts')
      .then((data) => setNeeds(data.needs))
      .catch(() => {
        /* keeps the last value */
      });
  }, []);
  const refreshCount = useCallback(() => {
    if (countTimer.current) clearTimeout(countTimer.current);
    countTimer.current = setTimeout(loadCount, COUNT_DEBOUNCE_MS);
  }, [loadCount]);
  const refreshRef = useRef(refreshCount);
  refreshRef.current = refreshCount;

  useEffect(() => {
    if (!isAuthenticated) {
      setNeeds(0);
      return;
    }
    loadCount();
    const id = setInterval(loadCount, COUNT_POLL_MS);
    return () => {
      clearInterval(id);
      if (countTimer.current) clearTimeout(countTimer.current);
    };
  }, [isAuthenticated, loadCount]);

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
      const notification = new Notification(title, { body, tag: conversationId, icon: '/apple-touch-icon.png' });
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
      refreshRef.current();
      const content = customerMessage(data);
      if (content === null || data.conversationId === viewingRef.current) return;
      showNotification(data.conversationId, tRef.current('conversations.alerts.newMessageTitle'), content.slice(0, 120));
      playSound(false);
    };

    const handleNotification = (data: NotificationPayload) => {
      if (data.type !== 'human_handoff') return;
      const conversationId = data.data?.['conversationId'];
      if (typeof conversationId !== 'string') return;
      const contactName = data.data?.['contactName'];
      refreshRef.current();
      showNotification(
        conversationId,
        tRef.current('conversations.alerts.handoffTitle'),
        typeof contactName === 'string' ? contactName : data.title
      );
      playSound(true);
    };

    const handleConversationChange = () => refreshRef.current();

    const handleChannelRestricted: WebSocketEvents['channel:restricted'] = (data) => {
      const channelLabel = getChannelMeta(data.channel).label;
      const planLabel = data.requiredPlan
        ? capitalizePlan(data.requiredPlan)
        : tRef.current('conversations.alerts.channelRestrictedFallbackPlan');
      warningRef.current(
        tRef.current('conversations.alerts.channelRestrictedTitle'),
        tRef.current('conversations.alerts.channelRestrictedMessage', { channel: channelLabel, plan: planLabel })
      );
    };

    const handleToolRestricted: WebSocketEvents['tool:restricted'] = (data) => {
      const toolLabel = tRef.current(`conversations.alerts.toolType.${data.toolType}`);
      const planLabel = data.requiredPlan
        ? capitalizePlan(data.requiredPlan)
        : tRef.current('conversations.alerts.channelRestrictedFallbackPlan');
      warningRef.current(
        tRef.current('conversations.alerts.toolRestrictedTitle'),
        tRef.current('conversations.alerts.toolRestrictedMessage', { tool: toolLabel, plan: planLabel })
      );
    };

    on('message:new', handleMessage);
    on('notification:new', handleNotification);
    on('takeover:status', handleConversationChange);
    on('conversation:update', handleConversationChange);
    on('connect', handleConversationChange);
    on('channel:restricted', handleChannelRestricted);
    on('tool:restricted', handleToolRestricted);
    return () => {
      off('message:new', handleMessage);
      off('notification:new', handleNotification);
      off('takeover:status', handleConversationChange);
      off('conversation:update', handleConversationChange);
      off('connect', handleConversationChange);
      off('channel:restricted', handleChannelRestricted);
      off('tool:restricted', handleToolRestricted);
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

  const count = needs;
  const hasUrgent = needs > 0;

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
          // 16px (or smaller) icons get a plain dot: a digit is unreadable there
          const dotOnly = size <= 16;
          const margin = Math.max(1, size * 0.05);
          const ring = Math.max(1, size * 0.06);
          const radius = size * (dotOnly ? 0.28 : 0.3);
          const cx = size - margin - ring - radius;
          const cy = margin + ring + radius;
          ctx.beginPath();
          ctx.arc(cx, cy, radius + ring, 0, Math.PI * 2);
          ctx.fillStyle = '#FFFFFF';
          ctx.fill();
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.fillStyle = hasUrgent ? '#EF4444' : '#128C7E';
          ctx.fill();
          if (!dotOnly) {
            const label = count > 9 ? '9+' : String(count);
            ctx.fillStyle = '#FFFFFF';
            ctx.font = `900 ${Math.round(radius * (label.length > 1 ? 1.15 : 1.4))}px Inter, Arial, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, cx, cy + radius * 0.06);
          }
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
