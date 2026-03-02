'use client';

import React from 'react';
import { MessageSquare, Bot, Users, FileText, Infinity as InfinityIcon } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import styles from './UsageBars.module.css';

interface UsageItem {
  used: number;
  limit: number | null;
  percent: number;
  addonMessages?: number;
}

interface UsageData {
  messages: UsageItem;
  agents: UsageItem;
  contacts: UsageItem;
  knowledgeFiles: UsageItem;
}

interface Props {
  usage: UsageData | null;
  loading: boolean;
  onBuyAddon?: () => void;
}

function getBarClass(percent: number): string {
  if (percent >= 80) return styles.barRed;
  if (percent >= 60) return styles.barYellow;
  return styles.barGreen;
}

interface BarItemProps {
  icon: React.ReactNode;
  label: string;
  item: UsageItem;
  note?: string;
  unlimitedLabel: string;
}

function BarItem({ icon, label, item, note, unlimitedLabel }: BarItemProps) {
  const isUnlimited = item.limit === null;

  return (
    <div className={styles.item}>
      <div className={styles.itemHeader}>
        <span className={styles.itemLabel}>
          {icon}
          {label}
        </span>
        {isUnlimited ? (
          <span className={styles.unlimited}>
            <InfinityIcon size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> {unlimitedLabel}
          </span>
        ) : (
          <span className={styles.itemValue}>
            {item.used.toLocaleString()} / {item.limit!.toLocaleString()} ({item.percent}%)
          </span>
        )}
      </div>
      {!isUnlimited && (
        <div className={styles.barTrack}>
          <div
            className={`${styles.barFill} ${getBarClass(item.percent)}`}
            style={{ width: `${Math.min(item.percent, 100)}%` }}
          />
        </div>
      )}
      {note && <div className={styles.addonNote}>{note}</div>}
    </div>
  );
}

export default function UsageBars({ usage, loading }: Props) {
  const { t } = useTranslation();

  if (loading || !usage) {
    return (
      <div className={styles.card}>
        <div className={styles.title}>{t('billing.usage.title')}</div>
        <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-sm)' }}>
          {t('billing.usage.loadingUsage')}
        </div>
      </div>
    );
  }

  const addonNote = (usage.messages.addonMessages ?? 0) > 0
    ? t('billing.usage.addonNote', { count: usage.messages.addonMessages!.toLocaleString() })
    : undefined;

  return (
    <div className={styles.card}>
      <div className={styles.title}>{t('billing.usage.title')}</div>
      <div className={styles.list}>
        <BarItem
          icon={<MessageSquare size={14} />}
          label={t('billing.usage.messages')}
          item={usage.messages}
          note={addonNote}
          unlimitedLabel={t('billing.usage.unlimited')}
        />
        <BarItem
          icon={<Bot size={14} />}
          label={t('billing.usage.agents')}
          item={usage.agents}
          unlimitedLabel={t('billing.usage.unlimited')}
        />
        <BarItem
          icon={<Users size={14} />}
          label={t('billing.usage.contacts')}
          item={usage.contacts}
          unlimitedLabel={t('billing.usage.unlimited')}
        />
        <BarItem
          icon={<FileText size={14} />}
          label={t('billing.usage.knowledgeFiles')}
          item={usage.knowledgeFiles}
          unlimitedLabel={t('billing.usage.unlimited')}
        />
      </div>
    </div>
  );
}
