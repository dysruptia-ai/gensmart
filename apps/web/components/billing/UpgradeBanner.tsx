'use client';

import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import styles from './UpgradeBanner.module.css';

interface Props {
  messagesPercent: number;
  messagesUsed: number;
  messagesLimit: number | null;
}

export default function UpgradeBanner({ messagesPercent, messagesUsed, messagesLimit }: Props) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;
  if (messagesPercent < 80) return null;
  if (messagesLimit === null) return null; // unlimited

  const isDanger = messagesPercent >= 100;

  return (
    <div className={`${styles.banner} ${isDanger ? styles.bannerDanger : styles.bannerWarning}`}>
      <div className={styles.left}>
        <AlertTriangle
          size={16}
          className={isDanger ? styles.iconDanger : styles.iconWarning}
        />
        <span className={styles.text}>
          {isDanger
            ? `You've used all ${messagesLimit.toLocaleString()} of your monthly messages. Your agents are paused.`
            : `You've used ${messagesPercent}% of your monthly messages (${messagesUsed.toLocaleString()} / ${messagesLimit.toLocaleString()}).`
          }
        </span>
      </div>
      <div className={styles.actions}>
        <Link href="/dashboard/billing">
          <Button variant="primary" size="sm">
            {isDanger ? 'Buy Add-on' : 'Upgrade Plan'}
          </Button>
        </Link>
        <button
          className={styles.dismissBtn}
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
