'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Star, AlertTriangle, XCircle, Bell } from 'lucide-react';
import { Notification } from '@/hooks/useNotifications';
import { useTranslation } from '@/hooks/useTranslation';
import { formatRelativeTime } from '@/lib/formatters';
import styles from './NotificationList.module.css';

interface NotificationListProps {
  notifications: Notification[];
  onMarkAllAsRead: () => void;
  onMarkAsRead: (id: string) => void;
  onClose: () => void;
}

function NotifIcon({ type }: { type: string }) {
  if (type === 'high_score_lead') return <Star size={16} className={styles.iconScore} />;
  if (type === 'plan_usage_80') return <AlertTriangle size={16} className={styles.iconWarning} />;
  if (type === 'plan_usage_100') return <AlertTriangle size={16} className={styles.iconDanger} />;
  if (type === 'plan_canceled') return <XCircle size={16} className={styles.iconDanger} />;
  return <Bell size={16} className={styles.iconNeutral} />;
}

function getNavTarget(notif: Notification): string | null {
  if (notif.type === 'high_score_lead') {
    const contactId = notif.data?.['contactId'] as string | undefined;
    const conversationId = notif.data?.['conversationId'] as string | undefined;
    if (contactId) return `/dashboard/contacts/${contactId}`;
    if (conversationId) return `/dashboard/conversations/${conversationId}`;
  }
  if (notif.type === 'plan_usage_80' || notif.type === 'plan_usage_100' || notif.type === 'plan_canceled') {
    return '/dashboard/billing';
  }
  return null;
}

export default function NotificationList({
  notifications,
  onMarkAllAsRead,
  onMarkAsRead,
  onClose,
}: NotificationListProps) {
  const router = useRouter();
  const { t, language } = useTranslation();
  const hasUnread = notifications.some((n) => !n.read);

  function handleItemClick(notif: Notification) {
    if (!notif.read) {
      onMarkAsRead(notif.id);
    }
    const target = getNavTarget(notif);
    if (target) {
      router.push(target);
      onClose();
    }
  }

  return (
    <div className={styles.dropdown}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>{t('notifications.title')}</span>
        {hasUnread && (
          <button className={styles.markAllBtn} onClick={onMarkAllAsRead}>
            {t('notifications.markAllRead')}
          </button>
        )}
      </div>

      <div className={styles.list}>
        {notifications.length === 0 ? (
          <div className={styles.emptyState}>
            <Bell size={32} className={styles.emptyIcon} />
            <p className={styles.emptyText}>{t('notifications.noNotificationsYet')}</p>
          </div>
        ) : (
          notifications.map((notif) => (
            <button
              key={notif.id}
              className={`${styles.item} ${!notif.read ? styles.itemUnread : ''}`}
              onClick={() => handleItemClick(notif)}
            >
              <span className={styles.itemIcon}>
                <NotifIcon type={notif.type} />
              </span>
              <span className={styles.itemContent}>
                <span className={styles.itemTitle}>{notif.title}</span>
                <span className={styles.itemMessage}>{notif.message}</span>
                <span className={styles.itemTime}>{formatRelativeTime(notif.createdAt, language)}</span>
              </span>
              {!notif.read && <span className={styles.unreadDot} aria-label={t('notifications.noNotificationsYet')} />}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
