'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { useTranslation } from '@/hooks/useTranslation';
import NotificationList from './NotificationList';
import styles from './NotificationBell.module.css';

interface NotificationBellProps {
  /** `up`: la lista se abre hacia arriba (pie del riel del shell). */
  placement?: 'down' | 'up';
}

export default function NotificationBell({ placement = 'down' }: NotificationBellProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className={`${styles.container} ${placement === 'up' ? styles.up : ''}`} ref={containerRef}>
      <button
        className={styles.bell}
        onClick={() => setOpen((v) => !v)}
        aria-label={unreadCount > 0 ? t('shell.notificationsUnread', { count: unreadCount }) : t('shell.notifications')}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Bell size={16} aria-hidden="true" />
        {unreadCount > 0 && (
          <span className={styles.dot} aria-hidden="true" />
        )}
      </button>

      {open && (
        <NotificationList
          notifications={notifications}
          onMarkAllAsRead={markAllAsRead}
          onMarkAsRead={markAsRead}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
