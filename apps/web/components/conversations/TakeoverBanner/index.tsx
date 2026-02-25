'use client';

import React from 'react';
import { Bot, User, ArrowUpRight } from 'lucide-react';
import Button from '@/components/ui/Button';
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
  if (status === 'closed') {
    return (
      <div className={`${styles.banner} ${styles.closed}`}>
        <span className={styles.text}>This conversation is closed.</span>
      </div>
    );
  }

  if (status === 'human_takeover') {
    if (takenOverBy === currentUserId) {
      return (
        <div className={`${styles.banner} ${styles.takeover}`}>
          <User size={14} aria-hidden="true" />
          <span className={styles.text}>You are in control of this conversation.</span>
          <Button
            variant="primary"
            size="sm"
            onClick={onRelease}
            loading={loading}
          >
            Release to AI
          </Button>
        </div>
      );
    }
    return (
      <div className={`${styles.banner} ${styles.takeover}`}>
        <User size={14} aria-hidden="true" />
        <span className={styles.text}>
          Taken over by <strong>{takeoverUserName ?? 'another agent'}</strong>
        </span>
      </div>
    );
  }

  // Active — show Take Over or Upgrade prompt
  if (!canTakeover) {
    return (
      <div className={`${styles.banner} ${styles.ai}`}>
        <Bot size={14} aria-hidden="true" />
        <span className={styles.text}>AI Agent is handling this conversation.</span>
        <Link href="/dashboard/billing" className={styles.upgradeLink}>
          Upgrade to enable takeover <ArrowUpRight size={12} aria-hidden="true" />
        </Link>
      </div>
    );
  }

  return (
    <div className={`${styles.banner} ${styles.ai}`}>
      <Bot size={14} aria-hidden="true" />
      <span className={styles.text}>AI Agent is handling this conversation.</span>
      <Button
        variant="outline"
        size="sm"
        onClick={onTakeover}
        loading={loading}
      >
        Take Over
      </Button>
    </div>
  );
}
