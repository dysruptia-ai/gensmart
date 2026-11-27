'use client';

import React from 'react';
import { Inbox, Menu, TriangleAlert, User } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import type { InboxCounts, InboxFilters, InboxView } from './types';
import styles from './InboxMobileNav.module.css';

export interface InboxMobileNavProps {
  filters: InboxFilters;
  counts: InboxCounts | null;
  onSelect: (view: InboxView) => void;
  onMore: () => void;
  moreOpen: boolean;
}

/** Navegación inferior en móvil: Todas, Ayuda, Mías y Más (abre el cajón con el riel). */
export default function InboxMobileNav({ filters, counts, onSelect, onMore, moreOpen }: InboxMobileNavProps) {
  const { t } = useTranslation();
  const scoped = !!filters.savedView || filters.agentIds.length > 0 || filters.channels.length > 0;
  const items: Array<{ view: InboxView; icon: typeof Inbox; badge: number }> = [
    { view: 'all', icon: Inbox, badge: 0 },
    { view: 'needs', icon: TriangleAlert, badge: counts?.needs ?? 0 },
    { view: 'mine', icon: User, badge: counts?.mine ?? 0 },
  ];
  return (
    <nav className={styles.nav} aria-label={t('inbox.mobileNav.label')}>
      {items.map(({ view, icon: Icon, badge }) => {
        const current = !scoped && filters.view === view;
        return (
          <button
            key={view}
            type="button"
            className={styles.item}
            aria-current={current ? 'page' : undefined}
            onClick={() => onSelect(view)}
          >
            <span className={styles.iconWrap}>
              <Icon size={20} aria-hidden="true" />
              {badge > 0 && (
                <span className={`${styles.badge} ${view === 'needs' ? styles.badgeUrgent : ''}`} aria-hidden="true">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </span>
            {t(`inbox.mobileNav.${view}`)}
            {badge > 0 && <span className="gsSr">{t('inbox.mobileNav.count', { count: badge })}</span>}
          </button>
        );
      })}
      <button type="button" className={styles.item} onClick={onMore} aria-expanded={moreOpen} aria-haspopup="dialog">
        <span className={styles.iconWrap}>
          <Menu size={20} aria-hidden="true" />
        </span>
        {t('inbox.mobileNav.more')}
      </button>
    </nav>
  );
}
