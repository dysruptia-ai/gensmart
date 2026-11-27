'use client';

import React from 'react';
import Link from 'next/link';
import { Bookmark, CircleCheckBig, Inbox, Plus, Settings, TriangleAlert, User, type LucideIcon } from 'lucide-react';
import { INBOX_LIMITS } from '@gensmart/shared';
import { useTranslation } from '@/hooks/useTranslation';
import { getChannelMeta } from './channelMeta';
import type { InboxCounts, InboxFilters, InboxView, SavedView } from './types';
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
  /** Ajustes de la bandeja abiertos (web-43): ninguna vista queda marcada. */
  settingsOpen?: boolean;
  /** Vistas guardadas de quien mira (web-44); null mientras cargan. */
  savedViews?: SavedView[] | null;
  onOpenView?: (id: string) => void;
  onNewView?: () => void;
}

/** El agente o el canal que eligió el riel: el filtro tiene solo ese valor. */
export function railScope(filters: InboxFilters): { agentId: string | null; channel: string | null } {
  const agentId = filters.agentIds.length === 1 && filters.channels.length === 0 ? filters.agentIds[0]! : null;
  const channel = filters.channels.length === 1 && filters.agentIds.length === 0 ? filters.channels[0]! : null;
  return { agentId, channel };
}

const VIEWS: Array<{ view: InboxView; icon: LucideIcon }> = [
  { view: 'all', icon: Inbox },
  { view: 'needs', icon: TriangleAlert },
  { view: 'mine', icon: User },
  { view: 'closed', icon: CircleCheckBig },
];

/** Riel de la Bandeja (236 px): vistas, agentes y canales. Bajo 1180 px vive en un cajón. */
export default function InboxRail({
  filters,
  counts,
  agents,
  onSelect,
  className,
  settingsOpen,
  savedViews,
  onOpenView,
  onNewView,
}: InboxRailProps) {
  const { t } = useTranslation();
  const scope = railScope(filters);
  const scoped = !!(scope.agentId || scope.channel || filters.savedView) || !!settingsOpen;
  const views = savedViews ?? [];
  const viewsFull = views.length >= INBOX_LIMITS.savedViewsPerUser;

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
                  onClick={() => onSelect({ view, savedView: null, ...(scope.agentId || scope.channel ? { agentIds: [], channels: [] } : {}) })}
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

        {onNewView && (
          <>
            <h2 className={styles.heading}>{t('inbox.views.saved')}</h2>
            <ul className={styles.list}>
              {views.map((v) => (
                <li key={v.id}>
                  <button
                    type="button"
                    className={styles.item}
                    aria-current={!settingsOpen && filters.savedView === v.id ? 'page' : undefined}
                    onClick={() => onOpenView?.(v.id)}
                    title={v.name}
                  >
                    <Bookmark size={16} aria-hidden="true" />
                    <span className={styles.name}>{v.name}</span>
                    <span className={styles.count}>{v.count}</span>
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  className={`${styles.item} ${styles.newView}`}
                  onClick={onNewView}
                  disabled={viewsFull}
                  aria-describedby={viewsFull ? 'inbox-views-full' : undefined}
                >
                  <Plus size={16} aria-hidden="true" />
                  <span className={styles.name}>{t('inbox.views.new')}</span>
                </button>
                {viewsFull && (
                  <p id="inbox-views-full" className={styles.note}>
                    {t('inbox.views.limit', { max: INBOX_LIMITS.savedViewsPerUser })}
                  </p>
                )}
              </li>
            </ul>
          </>
        )}

        {agentRows.length > 0 && (
          <>
            <h2 className={styles.heading}>{t('inbox.rail.agents')}</h2>
            <ul className={styles.list}>
              {agentRows.map((agent) => {
                const current = !settingsOpen && !filters.savedView && scope.agentId === agent.id;
                return (
                  <li key={agent.id}>
                    <button
                      type="button"
                      className={styles.item}
                      aria-current={current ? 'page' : undefined}
                      onClick={() => onSelect({ view: 'all', savedView: null, agentIds: [agent.id], channels: [] })}
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
                const current = !settingsOpen && !filters.savedView && scope.channel === channel;
                return (
                  <button
                    key={channel}
                    type="button"
                    className={styles.chip}
                    aria-pressed={current}
                    onClick={() => onSelect({ view: 'all', savedView: null, agentIds: [], channels: current ? [] : [channel] })}
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
      {/* Como en el diseño: el engranaje al pie del riel */}
      <div className={styles.foot}>
        <Link
          href="/dashboard/conversations/settings"
          className={styles.footLink}
          aria-current={settingsOpen ? 'page' : undefined}
        >
          <Settings size={16} aria-hidden="true" />
          <span>{t('inbox.settings.title')}</span>
        </Link>
      </div>
    </nav>
  );
}
