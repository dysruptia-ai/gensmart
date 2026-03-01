'use client';

import React from 'react';
import { MessageSquare, Bot, Users, FileText, Infinity as InfinityIcon } from 'lucide-react';
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

function formatNumber(n: number): string {
  return n.toLocaleString();
}

interface BarItemProps {
  icon: React.ReactNode;
  label: string;
  item: UsageItem;
  note?: string;
}

function BarItem({ icon, label, item, note }: BarItemProps) {
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
            <InfinityIcon size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> Unlimited
          </span>
        ) : (
          <span className={styles.itemValue}>
            {formatNumber(item.used)} / {formatNumber(item.limit!)} ({item.percent}%)
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
  if (loading || !usage) {
    return (
      <div className={styles.card}>
        <div className={styles.title}>Usage This Month</div>
        <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-sm)' }}>
          Loading usage data...
        </div>
      </div>
    );
  }

  const addonNote = (usage.messages.addonMessages ?? 0) > 0
    ? `Includes ${formatNumber(usage.messages.addonMessages!)} add-on messages`
    : undefined;

  return (
    <div className={styles.card}>
      <div className={styles.title}>Usage This Month</div>
      <div className={styles.list}>
        <BarItem
          icon={<MessageSquare size={14} />}
          label="Messages"
          item={usage.messages}
          note={addonNote}
        />
        <BarItem
          icon={<Bot size={14} />}
          label="Agents"
          item={usage.agents}
        />
        <BarItem
          icon={<Users size={14} />}
          label="Contacts"
          item={usage.contacts}
        />
        <BarItem
          icon={<FileText size={14} />}
          label="Knowledge Files"
          item={usage.knowledgeFiles}
        />
      </div>
    </div>
  );
}
