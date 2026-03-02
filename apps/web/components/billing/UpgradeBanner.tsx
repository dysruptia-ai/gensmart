'use client';

import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import { useTranslation } from '@/hooks/useTranslation';
import styles from './UpgradeBanner.module.css';

interface Props {
  messagesPercent: number;
  messagesUsed: number;
  messagesLimit: number | null;
}

export default function UpgradeBanner({ messagesPercent, messagesUsed, messagesLimit }: Props) {
  const { t } = useTranslation();
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
            ? t('billing.banner.allUsed', { limit: messagesLimit.toLocaleString() })
            : t('billing.banner.partialUsed', {
                percent: String(messagesPercent),
                used: messagesUsed.toLocaleString(),
                limit: messagesLimit.toLocaleString(),
              })
          }
        </span>
      </div>
      <div className={styles.actions}>
        <Link href="/dashboard/billing">
          <Button variant="primary" size="sm">
            {isDanger ? t('billing.banner.buyAddon') : t('billing.banner.upgradePlan')}
          </Button>
        </Link>
        <button
          className={styles.dismissBtn}
          onClick={() => setDismissed(true)}
          aria-label={t('common.close')}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
