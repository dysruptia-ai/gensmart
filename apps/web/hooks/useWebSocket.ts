'use client';

import { useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { getAccessToken } from '@/lib/api';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

// Module-level singleton
let sharedSocket: Socket | null = null;
let currentToken: string | null = null;

function getOrCreateSocket(): Socket | null {
  const token = getAccessToken();
  if (!token) return null;

  // If socket exists and token hasn't changed, reuse it
  if (sharedSocket && currentToken === token) {
    if (sharedSocket.connected || sharedSocket.active) {
      return sharedSocket;
    }
  }

  // Token changed or no socket — (re)create
  if (sharedSocket) {
    sharedSocket.disconnect();
  }

  currentToken = token;
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

  return sharedSocket;
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
      if (!socket) return;
      socket.on(event as string, handler as (...args: unknown[]) => void);
    },
    []
  );

  const off = useCallback(
    <E extends EventName>(event: E, handler?: EventHandler<E>) => {
      if (!sharedSocket) return;
      if (handler) {
        sharedSocket.off(event as string, handler as (...args: unknown[]) => void);
      } else {
        sharedSocket.off(event as string);
      }
    },
    []
  );

  const joinConversation = useCallback((conversationId: string) => {
    const socket = getOrCreateSocket();
    if (socket) socket.emit('conversation:join', conversationId);
  }, []);

  const leaveConversation = useCallback((conversationId: string) => {
    if (sharedSocket) sharedSocket.emit('conversation:leave', conversationId);
  }, []);

  const getSocket = useCallback((): Socket | null => {
    return getOrCreateSocket();
  }, []);

  return { on, off, joinConversation, leaveConversation, getSocket };
}
