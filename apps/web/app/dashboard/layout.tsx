'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Bot,
  MessageSquare,
  Users,
  GitBranch,
  Calendar,
  CreditCard,
  Settings,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import Avatar from '@/components/ui/Avatar';
import Spinner from '@/components/ui/Spinner';
import Skeleton from '@/components/ui/Skeleton';
import { Logo } from '@/components/ui/Logo';
import styles from './dashboard.module.css';

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, exact: true },
  { label: 'Agents', path: '/dashboard/agents', icon: Bot },
  { label: 'Conversations', path: '/dashboard/conversations', icon: MessageSquare },
  { label: 'Contacts', path: '/dashboard/contacts', icon: Users },
  { label: 'Funnel', path: '/dashboard/funnel', icon: GitBranch },
  { label: 'Calendar', path: '/dashboard/calendar', icon: Calendar },
  { label: 'Billing', path: '/dashboard/billing', icon: CreditCard },
  { label: 'Settings', path: '/dashboard/settings', icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className={styles.loadingScreen}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  function isActive(path: string, exact?: boolean): boolean {
    if (exact) return pathname === path;
    return pathname.startsWith(path);
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <Logo size="md" href="/dashboard" />
        </div>

        <nav className={styles.nav} aria-label="Main navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path, item.exact);
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
      </aside>

      <div className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerLeft} />

          <div className={styles.headerRight}>
            <div className={styles.userMenu}>
              <button
                className={styles.userButton}
                onClick={() => setUserMenuOpen((v) => !v)}
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
              >
                {user ? (
                  <Avatar name={user.name} size="sm" />
                ) : (
                  <Skeleton width={32} height={32} />
                )}
                <span className={styles.userName}>
                  {user?.name ?? ''}
                </span>
                <ChevronDown size={14} aria-hidden="true" />
              </button>

              {userMenuOpen && (
                <>
                  <div
                    className={styles.userMenuBackdrop}
                    onClick={() => setUserMenuOpen(false)}
                    aria-hidden="true"
                  />
                  <div className={styles.userDropdown} role="menu">
                    <div className={styles.userInfo}>
                      <span className={styles.userDisplayName}>{user?.name}</span>
                      <span className={styles.userEmail}>{user?.email}</span>
                      <span className={styles.userOrg}>{user?.orgName}</span>
                    </div>
                    <div className={styles.userDropdownDivider} />
                    <Link
                      href="/dashboard/settings"
                      className={styles.userDropdownItem}
                      role="menuitem"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <Settings size={14} aria-hidden="true" /> Settings
                    </Link>
                    <button
                      className={styles.userDropdownItem}
                      role="menuitem"
                      onClick={handleLogout}
                    >
                      <LogOut size={14} aria-hidden="true" /> Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className={styles.content}>
          {children}
        </main>
      </div>
    </div>
  );
}
