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

  // Ids already in the list, so an event and a refresh never count the same notification twice
  const knownIdsRef = useRef<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    try {
      const [notifData, countData] = await Promise.all([
        api.get<NotificationsResponse>('/api/notifications?limit=20'),
        api.get<UnreadCountResponse>('/api/notifications/unread-count'),
      ]);
      knownIdsRef.current = new Set(notifData.notifications.map((n) => n.id));
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

  // Fallback in case a real-time event is missed: refresh on focus and every 60 seconds
  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    window.addEventListener('focus', refreshIfVisible);
    document.addEventListener('visibilitychange', refreshIfVisible);
    const interval = setInterval(refreshIfVisible, 60_000);
    return () => {
      window.removeEventListener('focus', refreshIfVisible);
      document.removeEventListener('visibilitychange', refreshIfVisible);
      clearInterval(interval);
    };
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
      // Some emitters (e.g. the data export worker) send no id: reload the real rows instead.
      if (!data.id) {
        void refresh();
        return;
      }
      if (knownIdsRef.current.has(data.id)) return;
      knownIdsRef.current.add(data.id);
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
  }, [on, off, refresh]);

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
