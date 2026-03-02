'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { useWebSocket } from './useWebSocket';

export interface Notification {
  id: string;
  userId: string;
  organizationId: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  read: boolean;
  readAt: string | null;
  createdAt: string;
}

interface NotificationsResponse {
  notifications: Notification[];
  total: number;
}

interface UnreadCountResponse {
  count: number;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const { on, off } = useWebSocket();
  const handlerRef = useRef<((data: {
    id: string;
    type: string;
    title: string;
    message: string;
    data?: Record<string, unknown>;
    createdAt: string;
  }) => void) | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [notifData, countData] = await Promise.all([
        api.get<NotificationsResponse>('/api/notifications?limit=20'),
        api.get<UnreadCountResponse>('/api/notifications/unread-count'),
      ]);
      setNotifications(notifData.notifications);
      setUnreadCount(countData.count);
    } catch {
      // Non-critical — ignore errors
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Listen for new notifications via WebSocket
  useEffect(() => {
    const handler = (data: {
      id: string;
      type: string;
      title: string;
      message: string;
      data?: Record<string, unknown>;
      createdAt: string;
    }) => {
      const newNotif: Notification = {
        id: data.id,
        userId: '',
        organizationId: '',
        type: data.type,
        title: data.title,
        message: data.message,
        data: data.data ?? null,
        read: false,
        readAt: null,
        createdAt: data.createdAt,
      };
      setNotifications((prev) => [newNotif, ...prev]);
      setUnreadCount((prev) => prev + 1);
    };

    handlerRef.current = handler;
    on('notification:new', handler);

    return () => {
      if (handlerRef.current) {
        off('notification:new', handlerRef.current);
      }
    };
  }, [on, off]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      await api.put(`/api/notifications/${id}/read`, {});
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, read: true, readAt: new Date().toISOString() } : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // ignore
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await api.put('/api/notifications/read-all', {});
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read: true, readAt: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch {
      // ignore
    }
  }, []);

  return { notifications, unreadCount, isLoading, markAsRead, markAllAsRead, refresh };
}
