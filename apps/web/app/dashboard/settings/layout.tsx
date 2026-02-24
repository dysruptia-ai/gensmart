'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Settings, Users, Building2, Shield, Database } from 'lucide-react';
import styles from './settings.module.css';

const SETTINGS_NAV = [
  { label: 'General', path: '/dashboard/settings', icon: Settings, exact: true },
  { label: 'Team', path: '/dashboard/settings/team', icon: Users },
  { label: 'Sub-accounts', path: '/dashboard/settings/sub-accounts', icon: Building2 },
  { label: 'Security', path: '/dashboard/settings/security', icon: Shield },
  { label: 'Data', path: '/dashboard/settings/data', icon: Database },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  function isActive(path: string, exact?: boolean): boolean {
    if (exact) return pathname === path;
    return pathname.startsWith(path);
  }

  return (
    <div className={styles.shell}>
      <nav className={styles.sideNav} aria-label="Settings navigation">
        <p className={styles.sideNavTitle}>Settings</p>
        <ul className={styles.sideNavList}>
          {SETTINGS_NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path, item.exact);
            return (
              <li key={item.path}>
                <Link
                  href={item.path}
                  className={[styles.sideNavItem, active ? styles.sideNavItemActive : ''].filter(Boolean).join(' ')}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon size={15} aria-hidden="true" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className={styles.content}>
        {children}
      </div>
    </div>
  );
}
