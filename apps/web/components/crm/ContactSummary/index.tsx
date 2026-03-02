'use client';

import React, { useState } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import Button from '@/components/ui/Button';
import { useTranslation } from '@/hooks/useTranslation';
import styles from './ContactSummary.module.css';

interface ContactSummaryProps {
  summary: string | null;
  service: string | null;
  onReanalyze: () => Promise<void>;
}

export default function ContactSummary({ summary, service, onReanalyze }: ContactSummaryProps) {
  const { t } = useTranslation();
  const [analyzing, setAnalyzing] = useState(false);
  const [done, setDone] = useState(false);

  const handleReanalyze = async () => {
    setAnalyzing(true);
    setDone(false);
    try {
      await onReanalyze();
      setDone(true);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <Sparkles size={16} aria-hidden="true" className={styles.icon} />
          <h3 className={styles.title}>{t('contacts.detail.aiSummary')}</h3>
        </div>
        <Button
          size="sm"
          variant="ghost"
          icon={RefreshCw}
          loading={analyzing}
          onClick={handleReanalyze}
        >
          {done ? t('contacts.detail.queued') : t('contacts.detail.reanalyze')}
        </Button>
      </div>

      {service && (
        <div className={styles.serviceRow}>
          <span className={styles.serviceLabel}>{t('contacts.detail.detectedService')}</span>
          <span className={styles.serviceValue}>{service}</span>
        </div>
      )}

      <p className={styles.summary}>
        {summary ?? t('contacts.detail.noSummary')}
      </p>
    </div>
  );
}
