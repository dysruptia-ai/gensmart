'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { getAccessToken } from '@/lib/api';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

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
    variables: Record<string, unknown>;
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
}

type EventName = keyof WebSocketEvents;
type EventHandler<E extends EventName> = WebSocketEvents[E];

export function useWebSocket() {
  const socketRef = useRef<Socket | null>(null);

  const getSocket = useCallback((): Socket | null => {
    if (socketRef.current?.connected) return socketRef.current;

    const token = getAccessToken();
    if (!token) return null;

    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const socket = io(API_BASE, {
      auth: { token },
      transports: ['websocket', 'polling'],
      path: '/socket.io',
    });

    socket.on('connect', () => {
      console.log('[ws] Connected:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('[ws] Disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      console.error('[ws] Connection error:', err.message);
    });

    socketRef.current = socket;
    return socket;
  }, []);

  const on = useCallback(
    <E extends EventName>(event: E, handler: EventHandler<E>) => {
      const socket = getSocket();
      if (!socket) return;
      socket.on(event as string, handler as (...args: unknown[]) => void);
    },
    [getSocket]
  );

  const off = useCallback(
    <E extends EventName>(event: E, handler?: EventHandler<E>) => {
      const socket = socketRef.current;
      if (!socket) return;
      if (handler) {
        socket.off(event as string, handler as (...args: unknown[]) => void);
      } else {
        socket.off(event as string);
      }
    },
    []
  );

  const joinConversation = useCallback(
    (conversationId: string) => {
      const socket = getSocket();
      if (socket) socket.emit('conversation:join', conversationId);
    },
    [getSocket]
  );

  const leaveConversation = useCallback(
    (conversationId: string) => {
      const socket = socketRef.current;
      if (socket) socket.emit('conversation:leave', conversationId);
    },
    []
  );

  useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, []);

  return { on, off, joinConversation, leaveConversation, getSocket };
}
