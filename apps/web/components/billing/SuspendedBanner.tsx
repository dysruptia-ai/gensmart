'use client';

import React from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import Button from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/hooks/useTranslation';
import styles from './SuspendedBanner.module.css';

/** Persistent — unlike UpgradeBanner, this cannot be dismissed: the org is actually blocked. */
export default function SuspendedBanner() {
  const { isSuspended } = useAuth();
  const { t } = useTranslation();

  if (!isSuspended) return null;

  return (
    <div className={styles.banner}>
      <div className={styles.left}>
        <AlertTriangle size={16} className={styles.icon} />
        <span className={styles.text}>{t('billing.suspendedBanner.message')}</span>
      </div>
      <Link href="/dashboard/billing">
        <Button variant="primary" size="sm">
          {t('billing.suspendedBanner.cta')}
        </Button>
      </Link>
    </div>
  );
}
