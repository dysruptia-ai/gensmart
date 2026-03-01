'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Settings, Users, Building2, Shield, Database, Key } from 'lucide-react';
import { api } from '@/lib/api';
import styles from './settings.module.css';

const BASE_NAV = [
  { label: 'General', path: '/dashboard/settings', icon: Settings, exact: true },
  { label: 'Team', path: '/dashboard/settings/team', icon: Users },
  { label: 'Sub-accounts', path: '/dashboard/settings/sub-accounts', icon: Building2 },
  { label: 'Security', path: '/dashboard/settings/security', icon: Shield },
  { label: 'Data', path: '/dashboard/settings/data', icon: Database },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isEnterprise, setIsEnterprise] = useState(false);

  useEffect(() => {
    api.get<{ plan: string }>('/api/organization').then((org) => {
      setIsEnterprise(org.plan === 'enterprise');
    }).catch(() => { /* ignore */ });
  }, []);

  const nav = isEnterprise
    ? [...BASE_NAV, { label: 'API Keys', path: '/dashboard/settings/api-keys', icon: Key }]
    : BASE_NAV;

  function isActive(path: string, exact?: boolean): boolean {
    if (exact) return pathname === path;
    return pathname.startsWith(path);
  }

  return (
    <div className={styles.shell}>
      <nav className={styles.sideNav} aria-label="Settings navigation">
        <p className={styles.sideNavTitle}>Settings</p>
        <ul className={styles.sideNavList}>
          {nav.map((item) => {
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
