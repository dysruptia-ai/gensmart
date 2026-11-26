'use client';

import React from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { APP_NAV, type AppNavItemId } from '@/lib/app-nav';
import { useTranslation } from '@/hooks/useTranslation';
import NotificationBell from '@/components/notifications/NotificationBell';
import ShellLogo from './ShellLogo';
import AccountMenu from './AccountMenu';
import type { RailCounters } from './AppRail';
import styles from './AppRailCompact.module.css';

export interface AppRailCompactProps {
  activeId: AppNavItemId | null;
  counters: RailCounters;
  shortcut: string;
  plan: string | null;
  onOpenPalette: () => void;
  onLogout: () => void;
}

/**
 * Riel encogido a íconos (64 px) para la Bandeja. Cada ícono lleva `aria-label` y un tooltip
 * propio que aparece al pasar el cursor y al recibir el foco.
 */
export default function AppRailCompact({ activeId, counters, shortcut, plan, onOpenPalette, onLogout }: AppRailCompactProps) {
  const { t } = useTranslation();
  const searchLabel = `${t('shell.search')} (${shortcut})`;

  return (
    <div className={styles.rail}>
      <span className={styles.tip}>
        <ShellLogo label={t('shell.home')} variant="mark" size="sm" />
      </span>

      <span className={styles.tip}>
        <button type="button" className={styles.search} onClick={onOpenPalette} aria-label={searchLabel} aria-haspopup="dialog">
          <Search size={17} aria-hidden="true" />
        </button>
        <span className={styles.tooltip} aria-hidden="true">
          {t('shell.search')}
          <kbd className={styles.kbd}> ({shortcut})</kbd>
        </span>
      </span>

      <nav aria-label={t('shell.navLabel')} className={styles.nav}>
        {APP_NAV.map((group) => (
          <React.Fragment key={group.id}>
            <span className={styles.sep} aria-hidden="true" />
            <ul className={styles.list} aria-label={t(group.labelKey)}>
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = item.id === activeId;
                const label = t(item.labelKey);
                const showCount = item.id === 'inbox' && counters.inbox > 0;
                return (
                  <li key={item.id} className={styles.tip}>
                    <Link
                      href={item.href}
                      aria-label={
                        showCount
                          ? `${label}, ${t('conversations.alerts.badgeLabel', { count: counters.inbox })}`
                          : label
                      }
                      aria-current={active ? 'page' : undefined}
                      className={`${styles.item} ${active ? styles.active : ''}`}
                    >
                      <Icon size={18} aria-hidden="true" />
                      {showCount && (
                        <span className={`${styles.count} ${counters.inboxUrgent ? styles.countUrgent : ''}`} aria-hidden="true">
                          {counters.inbox > 99 ? '99+' : counters.inbox}
                        </span>
                      )}
                    </Link>
                    <span className={styles.tooltip} aria-hidden="true">{label}</span>
                  </li>
                );
              })}
            </ul>
          </React.Fragment>
        ))}
      </nav>

      <span className={styles.spacer} />
      <div className={styles.bell}>
        <NotificationBell placement="up" />
      </div>
      <AccountMenu variant="compact" plan={plan} onLogout={onLogout} />
    </div>
  );
}
