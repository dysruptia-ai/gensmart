'use client';

import React from 'react';
import Link from 'next/link';
import { Bell, Plus, Search } from 'lucide-react';
import { APP_NAV, type AppNavItemId } from '@/lib/app-nav';
import { useTranslation } from '@/hooks/useTranslation';
import NotificationBell from '@/components/notifications/NotificationBell';
import ShellLogo from './ShellLogo';
import AccountMenu from './AccountMenu';
import ShellThemeButton from './ShellThemeButton';
import styles from './AppRail.module.css';

export interface RailCounters {
  inbox: number;
  inboxUrgent: boolean;
  /** `null`: aún no se sabe o la llamada falló (sin contador). */
  agents: number | null;
}

export interface AppRailProps {
  activeId: AppNavItemId | null;
  counters: RailCounters;
  shortcut: string;
  plan: string | null;
  canAskPermission: boolean;
  onEnableAlerts: () => void;
  onOpenPalette: () => void;
  onLogout: () => void;
  /** En el cajón: se cierra al navegar. */
  onNavigate?: () => void;
  className?: string;
}

/** El riel completo (248 px desde 1080 px; también es el contenido del cajón en móvil). */
export default function AppRail({
  activeId,
  counters,
  shortcut,
  plan,
  canAskPermission,
  onEnableAlerts,
  onOpenPalette,
  onLogout,
  onNavigate,
  className,
}: AppRailProps) {
  const { t } = useTranslation();

  return (
    <div className={`${styles.rail} ${className ?? ''}`}>
      <div className={styles.brand}>
        <ShellLogo label={t('shell.home')} onNavigate={onNavigate} />
      </div>

      <button type="button" className={styles.search} onClick={onOpenPalette} aria-haspopup="dialog">
        <Search size={15} aria-hidden="true" />
        <span className={styles.searchText}>{t('shell.search')}</span>
        <kbd className={styles.kbd}>{shortcut}</kbd>
      </button>

      <Link href="/dashboard/agents/new" className={styles.create} onClick={onNavigate}>
        <Plus size={15} aria-hidden="true" />
        {t('shell.createAgent')}
      </Link>

      <nav className={styles.nav} aria-label={t('shell.navLabel')}>
        {APP_NAV.map((group) => {
          const headingId = `rail-group-${group.id}`;
          return (
            <div key={group.id} className={styles.group} role="group" aria-labelledby={headingId}>
              <span id={headingId} className={styles.groupTitle}>{t(group.labelKey)}</span>
              <ul className={styles.list}>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = item.id === activeId;
                  const count =
                    item.id === 'inbox' ? counters.inbox : item.id === 'agents' ? counters.agents : null;
                  const showCount = count !== null && count > 0;
                  const urgent = item.id === 'inbox' && counters.inboxUrgent;
                  return (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        className={`${styles.item} ${active ? styles.active : ''}`}
                        aria-current={active ? 'page' : undefined}
                        onClick={onNavigate}
                      >
                        <Icon size={17} className={styles.icon} aria-hidden="true" />
                        <span className={styles.label}>{t(item.labelKey)}</span>
                        {showCount && (
                          <span
                            className={`${styles.count} ${urgent ? styles.countUrgent : ''}`}
                            aria-label={
                              item.id === 'inbox'
                                ? t('conversations.alerts.badgeLabel', { count })
                                : undefined
                            }
                          >
                            {count > 99 ? '99+' : count}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {canAskPermission && (
        <button type="button" className={styles.alerts} onClick={onEnableAlerts}>
          <Bell size={13} aria-hidden="true" />
          {t('shell.enableAlerts')}
        </button>
      )}

      <div className={styles.foot}>
        <AccountMenu variant="full" plan={plan} onLogout={onLogout} />
        <NotificationBell placement="up" />
        <ShellThemeButton />
      </div>
    </div>
  );
}
