'use client';

import React from 'react';
import { CircleCheckBig, Inbox, TriangleAlert, User, type LucideIcon } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { getChannelMeta } from './channelMeta';
import type { InboxCounts, InboxFilters, InboxView } from './types';
import styles from './InboxRail.module.css';

export interface RailAgent {
  id: string;
  name: string;
}

export interface InboxRailProps {
  filters: InboxFilters;
  counts: InboxCounts | null;
  agents: RailAgent[];
  onSelect: (next: Partial<InboxFilters>) => void;
  className?: string;
}

const VIEWS: Array<{ view: InboxView; icon: LucideIcon }> = [
  { view: 'all', icon: Inbox },
  { view: 'needs', icon: TriangleAlert },
  { view: 'mine', icon: User },
  { view: 'closed', icon: CircleCheckBig },
];

/** Riel de la Bandeja (236 px): vistas, agentes y canales. Bajo 1180 px vive en un cajón. */
export default function InboxRail({ filters, counts, agents, onSelect, className }: InboxRailProps) {
  const { t } = useTranslation();
  const scoped = !!(filters.agentId || filters.channel);

  // Agentes: los de la organización (aunque no tengan conversaciones) más los que solo aparecen en los contadores
  const agentCount = new Map((counts?.byAgent ?? []).map((a) => [a.agentId, a.count]));
  const agentRows: RailAgent[] = [...agents];
  for (const a of counts?.byAgent ?? []) {
    if (!agentRows.some((r) => r.id === a.agentId)) agentRows.push({ id: a.agentId, name: a.agentName || t('inbox.rail.unnamedAgent') });
  }
  const channels = counts?.byChannel ?? [];

  return (
    <nav className={[styles.rail, className].filter(Boolean).join(' ')} aria-label={t('inbox.rail.label')}>
      <div className={styles.scroll}>
        <h2 className={styles.heading}>{t('inbox.rail.inbox')}</h2>
        <ul className={styles.list}>
          {VIEWS.map(({ view, icon: Icon }) => {
            const current = !scoped && filters.view === view;
            const count = counts ? counts[view] : null;
            return (
              <li key={view}>
                <button
                  type="button"
                  className={styles.item}
                  aria-current={current ? 'page' : undefined}
                  onClick={() => onSelect({ view, agentId: null, channel: null })}
                >
                  <Icon size={16} aria-hidden="true" className={view === 'needs' && count ? styles.urgentIcon : undefined} />
                  <span className={styles.name}>{t(`inbox.views.${view}`)}</span>
                  {count !== null && (
                    <span className={`${styles.count} ${view === 'needs' && count > 0 ? styles.countUrgent : ''}`}>{count}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        {agentRows.length > 0 && (
          <>
            <h2 className={styles.heading}>{t('inbox.rail.agents')}</h2>
            <ul className={styles.list}>
              {agentRows.map((agent) => {
                const current = filters.agentId === agent.id;
                return (
                  <li key={agent.id}>
                    <button
                      type="button"
                      className={styles.item}
                      aria-current={current ? 'page' : undefined}
                      onClick={() => onSelect({ view: 'all', agentId: agent.id, channel: null })}
                    >
                      <span className={styles.dot} aria-hidden="true" />
                      <span className={styles.name}>{agent.name}</span>
                      {counts && <span className={styles.count}>{agentCount.get(agent.id) ?? 0}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {channels.length > 0 && (
          <>
            <h2 className={styles.heading}>{t('inbox.rail.channels')}</h2>
            <div className={styles.chips}>
              {channels.map(({ channel, count }) => {
                const meta = getChannelMeta(channel);
                const current = filters.channel === channel;
                return (
                  <button
                    key={channel}
                    type="button"
                    className={styles.chip}
                    aria-pressed={current}
                    onClick={() => onSelect({ view: 'all', agentId: null, channel: current ? null : channel })}
                  >
                    <i className={styles.chipDot} style={{ background: meta.color }} aria-hidden="true" />
                    {meta.label}
                    <b>{count}</b>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </nav>
  );
}
