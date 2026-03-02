'use client';

import React from 'react';
import { Zap } from 'lucide-react';
import Button from '@/components/ui/Button';
import { useTranslation } from '@/hooks/useTranslation';
import styles from './AddOnCards.module.css';

interface Props {
  onBuy: (addon: 'messages_500' | 'messages_2000' | 'messages_5000') => void;
  loading: 'messages_500' | 'messages_2000' | 'messages_5000' | null;
  plan: string;
}

const ADDONS = [
  {
    key: 'messages_500' as const,
    messages: 500,
    price: '$10',
    perMessage: '$0.020',
  },
  {
    key: 'messages_2000' as const,
    messages: 2000,
    price: '$30',
    perMessage: '$0.015',
    popular: true,
  },
  {
    key: 'messages_5000' as const,
    messages: 5000,
    price: '$60',
    perMessage: '$0.012',
  },
];

export default function AddOnCards({ onBuy, loading, plan }: Props) {
  const { t } = useTranslation();

  // Don't show add-ons for Enterprise (unlimited or BYO key)
  if (plan === 'enterprise') return null;

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>{t('billing.addons.sectionTitle')}</div>
          <div className={styles.subtitle}>{t('billing.addons.oneTimePurchase')}</div>
        </div>
      </div>

      <div className={styles.grid}>
        {ADDONS.map((addon) => (
          <div key={addon.key} className={styles.addonCard}>
            <div className={styles.addonMessages}>{addon.messages.toLocaleString()}</div>
            <div className={styles.addonUnit}>{t('billing.addons.extraMessages')}</div>
            <div className={styles.addonPrice}>{addon.price}</div>
            <div className={styles.addonPerMessage}>{addon.perMessage} / {t('billing.addons.perMessage')}</div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => onBuy(addon.key)}
              loading={loading === addon.key}
              style={{ width: '100%', marginTop: '0.5rem' }}
            >
              <Zap size={14} />
              {t('billing.addons.buyNow')}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
