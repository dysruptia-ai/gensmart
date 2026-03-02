'use client';

import React from 'react';
import { Bot, User, ArrowUpRight } from 'lucide-react';
import Button from '@/components/ui/Button';
import { useTranslation } from '@/hooks/useTranslation';
import styles from './TakeoverBanner.module.css';
import Link from 'next/link';

interface TakeoverBannerProps {
  status: 'active' | 'human_takeover' | 'closed';
  takenOverBy: string | null;
  takeoverUserName: string | null;
  currentUserId: string;
  canTakeover: boolean;
  onTakeover: () => void;
  onRelease: () => void;
  loading?: boolean;
}

export default function TakeoverBanner({
  status,
  takenOverBy,
  takeoverUserName,
  currentUserId,
  canTakeover,
  onTakeover,
  onRelease,
  loading = false,
}: TakeoverBannerProps) {
  const { t } = useTranslation();

  if (status === 'closed') {
    return (
      <div className={`${styles.banner} ${styles.closed}`}>
        <span className={styles.text}>{t('conversations.takeover.closed')}</span>
      </div>
    );
  }

  if (status === 'human_takeover') {
    if (takenOverBy === currentUserId) {
      return (
        <div className={`${styles.banner} ${styles.takeover}`}>
          <User size={14} aria-hidden="true" />
          <span className={styles.text}>{t('conversations.takeover.inControl')}</span>
          <Button
            variant="primary"
            size="sm"
            onClick={onRelease}
            loading={loading}
          >
            {t('conversations.chat.release')}
          </Button>
        </div>
      );
    }
    return (
      <div className={`${styles.banner} ${styles.takeover}`}>
        <User size={14} aria-hidden="true" />
        <span className={styles.text}>
          {t('conversations.takeover.takenBy', { name: takeoverUserName ?? t('conversations.contactInfo.noContact') })}
        </span>
      </div>
    );
  }

  // Active — show Take Over or Upgrade prompt
  if (!canTakeover) {
    return (
      <div className={`${styles.banner} ${styles.ai}`}>
        <Bot size={14} aria-hidden="true" />
        <span className={styles.text}>{t('conversations.takeover.aiHandling')}</span>
        <Link href="/dashboard/billing" className={styles.upgradeLink}>
          {t('conversations.takeover.upgradeTakeover')} <ArrowUpRight size={12} aria-hidden="true" />
        </Link>
      </div>
    );
  }

  return (
    <div className={`${styles.banner} ${styles.ai}`}>
      <Bot size={14} aria-hidden="true" />
      <span className={styles.text}>{t('conversations.takeover.aiHandling')}</span>
      <Button
        variant="outline"
        size="sm"
        onClick={onTakeover}
        loading={loading}
      >
        {t('conversations.chat.takeover')}
      </Button>
    </div>
  );
}
