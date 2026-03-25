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
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/hooks/useTranslation';
import Avatar from '@/components/ui/Avatar';
import Spinner from '@/components/ui/Spinner';
import Skeleton from '@/components/ui/Skeleton';
import { Logo } from '@/components/ui/Logo';
import UpgradeBanner from '@/components/billing/UpgradeBanner';
import NotificationBell from '@/components/notifications/NotificationBell';
import WelcomeTour from '@/components/onboarding/WelcomeTour';
import { api } from '@/lib/api';
import styles from './dashboard.module.css';

const NAV_ITEMS = [
  { labelKey: 'nav.dashboard', path: '/dashboard', icon: LayoutDashboard, exact: true },
  { labelKey: 'nav.agents', path: '/dashboard/agents', icon: Bot },
  { labelKey: 'nav.conversations', path: '/dashboard/conversations', icon: MessageSquare },
  { labelKey: 'nav.contacts', path: '/dashboard/contacts', icon: Users },
  { labelKey: 'nav.funnel', path: '/dashboard/funnel', icon: GitBranch },
  { labelKey: 'nav.calendar', path: '/dashboard/calendar', icon: Calendar },
  { labelKey: 'nav.billing', path: '/dashboard/billing', icon: CreditCard },
  { labelKey: 'nav.settings', path: '/dashboard/settings', icon: Settings },
];

interface UsageSummary {
  messages: { used: number; limit: number | null; percent: number };
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const { t } = useTranslation();
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [usageSummary, setUsageSummary] = React.useState<UsageSummary | null>(null);
  const [trialEndsAt, setTrialEndsAt] = React.useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  // Load usage summary for upgrade banner
  useEffect(() => {
    if (!isAuthenticated) return;
    api.get<UsageSummary>('/api/billing/usage').then((data) => {
      setUsageSummary(data);
    }).catch(() => { /* ignore — non-critical */ });
    api.get<{ trial_ends_at?: string | null }>('/api/organization').then((org) => {
      if (org.trial_ends_at) setTrialEndsAt(org.trial_ends_at);
    }).catch(() => {});
  }, [isAuthenticated]);

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

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
      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className={styles.sidebarBackdrop}
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarHeader}>
          <div data-tour="logo">
            <Logo size="md" href="/dashboard" />
          </div>
          <button
            className={styles.sidebarCloseBtn}
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
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
                {t(item.labelKey)}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <button
              className={styles.hamburger}
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
              aria-expanded={sidebarOpen}
            >
              <Menu size={22} />
            </button>
          </div>

          <div className={styles.headerRight}>
            <NotificationBell />
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
                      <Settings size={14} aria-hidden="true" /> {t('nav.settings')}
                    </Link>
                    <button
                      className={styles.userDropdownItem}
                      role="menuitem"
                      onClick={handleLogout}
                    >
                      <LogOut size={14} aria-hidden="true" /> {t('nav.logout')}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {trialEndsAt && (
          <div className={styles.trialBanner}>
            <span>
              Your Pro trial ends in {Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} days
              {' '}&mdash;{' '}
              <Link href="/dashboard/billing">Upgrade to keep your agents</Link>
            </span>
          </div>
        )}

        <main className={styles.content}>
          {usageSummary && (
            <UpgradeBanner
              messagesPercent={usageSummary.messages.percent}
              messagesUsed={usageSummary.messages.used}
              messagesLimit={usageSummary.messages.limit}
            />
          )}
          {children}
        </main>
      </div>

      {user && !user.onboardingCompleted && <WelcomeTour />}
    </div>
  );
}
