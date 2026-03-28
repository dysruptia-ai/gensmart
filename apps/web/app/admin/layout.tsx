'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Settings,
  Building2,
  LogOut,
  ArrowLeft,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import Avatar from '@/components/ui/Avatar';
import Spinner from '@/components/ui/Spinner';
import { Logo } from '@/components/ui/Logo';
import styles from './admin.module.css';

const ADMIN_NAV = [
  { label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'Settings', path: '/admin/settings', icon: Settings },
  { label: 'Organizations', path: '/admin/organizations', icon: Building2 },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, isAuthenticated, logout } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isLoading && isAuthenticated && !user?.isSuperAdmin) {
      router.replace('/dashboard');
    }
  }, [isLoading, isAuthenticated, user, router]);

  if (isLoading) {
    return (
      <div className={styles.loadingScreen}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated || !user?.isSuperAdmin) {
    return null;
  }

  function isActive(path: string): boolean {
    if (path === '/admin/dashboard') return pathname === '/admin' || pathname === '/admin/dashboard';
    return pathname.startsWith(path);
  }

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <Logo size="md" href="/admin" />
          <span className={styles.adminBadge}>Admin</span>
        </div>

        <nav className={styles.nav}>
          {ADMIN_NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                href={item.path}
                className={[styles.navItem, active ? styles.navItemActive : ''].filter(Boolean).join(' ')}
                aria-current={active ? 'page' : undefined}
              >
                <Icon size={18} aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className={styles.sidebarFooter}>
          <Link href="/dashboard" className={styles.backLink}>
            <ArrowLeft size={16} aria-hidden="true" />
            Back to Dashboard
          </Link>
        </div>
      </aside>

      <div className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerLeft} />
          <div className={styles.headerRight}>
            <Avatar name={user.name} size="sm" />
            <span className={styles.userName}>{user.name}</span>
            <button className={styles.logoutBtn} onClick={handleLogout} title="Logout">
              <LogOut size={16} />
            </button>
          </div>
        </header>

        <main className={styles.content}>
          {children}
        </main>
      </div>
    </div>
  );
}
