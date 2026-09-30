'use client';

import { useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { getAccessToken } from '@/lib/api';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

// Module-level singleton
let sharedSocket: Socket | null = null;
let currentToken: string | null = null;
let currentIdentity: string | null = null;

type AnyHandler = (...args: unknown[]) => void;

// Listeners registered while there is no socket yet (token not ready); attached on creation.
const pendingListeners: Array<{ event: string; handler: AnyHandler }> = [];
let pendingTimer: ReturnType<typeof setInterval> | null = null;

// Conversation rooms to rejoin after a reconnection (the server forgets rooms on disconnect).
const joinedConversations = new Set<string>();

/**
 * "<userId>:<orgId>" from the access token payload. The server only checks the token at
 * connection time, so the client must tell a renewal (same identity) from a different
 * account. If the payload cannot be decoded, the token itself is returned: any change
 * then counts as a new identity.
 */
export function identityOf(token: string): string {
  try {
    const payload = token.split('.')[1];
    if (!payload) return token;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as { userId?: unknown; orgId?: unknown };
    if (typeof parsed.userId === 'string' && typeof parsed.orgId === 'string') {
      return `${parsed.userId}:${parsed.orgId}`;
    }
    return token;
  } catch {
    return token;
  }
}

function dropSharedSocket(): void {
  if (sharedSocket) {
    sharedSocket.disconnect();
    sharedSocket = null;
  }
  currentToken = null;
  currentIdentity = null;
  joinedConversations.clear();
}

/** Disconnects and discards the shared socket (logout or a failed session refresh). */
export function disconnectSharedSocket(): void {
  dropSharedSocket();
  pendingListeners.length = 0;
  if (pendingTimer) {
    clearInterval(pendingTimer);
    pendingTimer = null;
  }
}

function getOrCreateSocket(): Socket | null {
  const token = getAccessToken();
  if (!token) {
    if (sharedSocket) dropSharedSocket();
    return null;
  }

  const identity = identityOf(token);

  // Same identity: keep the instance (and its listeners) across token refreshes and only
  // update the credentials used for future reconnections.
  if (sharedSocket && currentIdentity === identity) {
    if (currentToken !== token) {
      currentToken = token;
      sharedSocket.auth = { token };
    }
    if (!sharedSocket.connected && !sharedSocket.active) {
      sharedSocket.connect();
    }
    return sharedSocket;
  }

  // Different user or organization: never reuse the previous account's socket or rooms.
  if (sharedSocket) dropSharedSocket();

  currentToken = token;
  currentIdentity = identity;
  sharedSocket = io(API_BASE, {
    auth: { token },
    transports: ['websocket', 'polling'],
    path: '/socket.io',
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 10,
  });

  sharedSocket.on('connect', () => {
    console.log('[ws] Connected:', sharedSocket?.id);
    joinedConversations.forEach((id) => sharedSocket?.emit('conversation:join', id));
  });

  sharedSocket.on('disconnect', (reason) => {
    console.log('[ws] Disconnected:', reason);
  });

  sharedSocket.on('connect_error', (err) => {
    console.error('[ws] Connection error:', err.message);
    // If auth error, try reconnecting with fresh token
    if (err.message === 'Invalid token' || err.message === 'Authentication required') {
      const freshToken = getAccessToken();
      if (freshToken && freshToken !== currentToken) {
        currentToken = freshToken;
        if (sharedSocket) {
          sharedSocket.auth = { token: freshToken };
          sharedSocket.connect();
        }
      }
    }
  });

  for (const { event, handler } of pendingListeners.splice(0)) {
    sharedSocket.on(event, handler);
  }
  if (pendingTimer) {
    clearInterval(pendingTimer);
    pendingTimer = null;
  }

  return sharedSocket;
}

// When a listener is registered before the access token exists, retry until the socket can be created.
function waitForSocket(): void {
  if (pendingTimer) return;
  let attempts = 0;
  pendingTimer = setInterval(() => {
    attempts += 1;
    if (getOrCreateSocket() || attempts >= 60) {
      if (pendingTimer) clearInterval(pendingTimer);
      pendingTimer = null;
    }
  }, 1000);
}

export interface WebSocketEvents {
  'conversation:update': (data: {
    conversationId: string;
    lastMessage?: string;
    status?: string;
    updatedAt: string;
  }) => void;
  'message:new': (data: {
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
  }) => void;
  'variables:update': (data: {
    conversationId: string;
    contactId?: string | null;
    variables: Record<string, unknown>;
  }) => void;
  'contact:scored': (data: {
    contactId: string | null;
    conversationId: string;
    score: number;
    summary: string;
    service: string;
    funnelStage?: string;
  }) => void;
  'takeover:status': (data: {
    conversationId: string;
    status: string;
    userId: string | null;
    userName?: string;
  }) => void;
  'usage:limit_reached': (data: {
    conversationId: string;
    current: number;
    limit: number;
  }) => void;
  'notification:new': (data: {
    id: string;
    type: string;
    title: string;
    message: string;
    data?: Record<string, unknown>;
    createdAt: string;
  }) => void;
}

type EventName = keyof WebSocketEvents;
type EventHandler<E extends EventName> = WebSocketEvents[E];

export function useWebSocket() {
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    // Ensure socket is created when component mounts
    getOrCreateSocket();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const on = useCallback(
    <E extends EventName>(event: E, handler: EventHandler<E>) => {
      const socket = getOrCreateSocket();
      if (!socket) {
        pendingListeners.push({ event: event as string, handler: handler as AnyHandler });
        waitForSocket();
        return;
      }
      socket.on(event as string, handler as AnyHandler);
    },
    []
  );

  const off = useCallback(
    <E extends EventName>(event: E, handler?: EventHandler<E>) => {
      for (let i = pendingListeners.length - 1; i >= 0; i--) {
        const p = pendingListeners[i]!;
        if (p.event === event && (!handler || p.handler === (handler as AnyHandler))) {
          pendingListeners.splice(i, 1);
        }
      }
      if (!sharedSocket) return;
      if (handler) {
        sharedSocket.off(event as string, handler as AnyHandler);
      } else {
        sharedSocket.off(event as string);
      }
    },
    []
  );

  const joinConversation = useCallback((conversationId: string) => {
    joinedConversations.add(conversationId);
    const socket = getOrCreateSocket();
    if (socket) socket.emit('conversation:join', conversationId);
  }, []);

  const leaveConversation = useCallback((conversationId: string) => {
    joinedConversations.delete(conversationId);
    if (sharedSocket) sharedSocket.emit('conversation:leave', conversationId);
  }, []);

  const getSocket = useCallback((): Socket | null => {
    return getOrCreateSocket();
  }, []);

  return { on, off, joinConversation, leaveConversation, getSocket };
}
