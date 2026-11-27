'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, Search, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ConversationAlertsProvider, useConversationAlerts } from '@/contexts/ConversationAlertsContext';
import { useTranslation } from '@/hooks/useTranslation';
import { useAppTheme } from '@/lib/app-theme';
import { activeNavItem, isInboxRoute } from '@/lib/app-nav';
import { trapTab } from '@/lib/focus-trap';
import Spinner from '@/components/ui/Spinner';
import UpgradeBanner from '@/components/billing/UpgradeBanner';
import SuspendedBanner from '@/components/billing/SuspendedBanner';
import AppRail, { type RailCounters } from './AppRail';
import AppRailCompact from './AppRailCompact';
import CommandPalette from './CommandPalette';
import ShellLogo from './ShellLogo';
import TrialNotice from './TrialNotice';
import { useIsDesktop, useOrgAgents, useOrgSummary, useShortcutLabel } from './useShellData';
import styles from './AppShell.module.css';

/** Shell del dashboard (web-40): riel, menú del avatar, avisos del plan, paleta y cajón en móvil. */
export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ConversationAlertsProvider>
      <Shell>{children}</Shell>
    </ConversationAlertsProvider>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const { language, setLanguage } = useLanguage();
  const { theme, setTheme } = useAppTheme();
  const { t } = useTranslation();
  const { count: alertCount, hasUrgent, canAskPermission, enableAlerts } = useConversationAlerts();
  const isDesktop = useIsDesktop();
  const shortcut = useShortcutLabel();
  const { org, usage } = useOrgSummary(isAuthenticated);
  const orgAgents = useOrgAgents(isAuthenticated ? user?.orgId : undefined);

  const [paletteOpen, setPaletteOpen] = useState(false);
  // El cajón queda abierto solo en la ruta donde se abrió: al navegar se cierra solo
  const [drawerAt, setDrawerAt] = useState<string | null>(null);
  const drawerOpen = drawerAt === pathname;
  const paletteOpener = useRef<HTMLElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);

  const active = activeNavItem(pathname);
  const compact = isInboxRoute(pathname);
  // Pantallas ya migradas al diseño nuevo: las de "viene en camino" y la Bandeja (web-41)
  const legacy = active?.status !== 'pending' && !compact;

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login');
  }, [isLoading, isAuthenticated, router]);

  // Título de la pestaña en el idioma activo ("Hoy | GenSmart"). Next escribe el <title> de la
  // metadata (en inglés) a veces después de este efecto: se vuelve a poner mientras haga falta.
  // web-44: Ajustes de la bandeja tiene su propio título ("Ajustes de la bandeja | GenSmart")
  const tabTitle =
    pathname === '/dashboard/conversations/settings'
      ? `${t('inbox.settings.title')} | GenSmart`
      : active
        ? `${t(active.labelKey)} | GenSmart`
        : 'GenSmart';
  useEffect(() => {
    const apply = () => {
      if (document.title !== tabTitle) document.title = tabTitle;
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [tabTitle]);

  const openPalette = useCallback((opener?: HTMLElement | null) => {
    paletteOpener.current = opener ?? (document.activeElement as HTMLElement | null);
    setPaletteOpen(true);
  }, []);

  const closePalette = useCallback(() => {
    setPaletteOpen(false);
    const opener = paletteOpener.current;
    paletteOpener.current = null;
    // Si quien la abrió ya no está (el cajón se cerró), el foco va al botón del menú
    requestAnimationFrame(() => {
      const target = opener && opener.isConnected ? opener : menuButtonRef.current;
      target?.focus();
    });
  }, []);

  // Ctrl/Cmd+K desde cualquier pantalla, también con el foco en un campo de texto
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (paletteOpen) {
          closePalette();
        } else {
          if (drawerOpen) {
            setDrawerAt(null);
            openPalette(menuButtonRef.current);
          } else {
            openPalette();
          }
        }
      }
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [paletteOpen, drawerOpen, openPalette, closePalette]);

  const closeDrawer = useCallback(() => {
    setDrawerAt(null);
    menuButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    drawerCloseRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [drawerOpen]);

  const handleLogout = useCallback(async () => {
    await logout();
    router.replace('/login');
  }, [logout, router]);

  const navigate = useCallback((href: string) => router.push(href), [router]);
  const toggleTheme = useCallback(() => setTheme(theme === 'dark' ? 'light' : 'dark'), [theme, setTheme]);
  const otherLanguage = language === 'es' ? 'en' : 'es';
  const toggleLanguage = useCallback(() => setLanguage(otherLanguage), [otherLanguage, setLanguage]);

  if (isLoading) {
    return (
      <div className={`gsApp ${styles.loading}`}>
        <Spinner size="lg" />
      </div>
    );
  }
  if (!isAuthenticated) return null;

  const counters: RailCounters = {
    inbox: alertCount,
    inboxUrgent: hasUrgent,
    agents: orgAgents ? orgAgents.total : null,
  };
  const plan = org?.plan ?? null;
  const railProps = {
    activeId: active?.id ?? null,
    counters,
    shortcut,
    plan,
    canAskPermission,
    onEnableAlerts: () => void enableAlerts(),
    onLogout: () => void handleLogout(),
  };

  return (
    <div className={`gsApp gsShell ${styles.shell}`}>
      {isDesktop ? (
        <aside className={`${styles.railCol} ${compact ? styles.railColCompact : ''}`}>
          {compact ? (
            <AppRailCompact {...railProps} onOpenPalette={() => openPalette()} />
          ) : (
            <AppRail {...railProps} onOpenPalette={() => openPalette()} />
          )}
        </aside>
      ) : (
        <header className={styles.topBar}>
          <button
            ref={menuButtonRef}
            type="button"
            className={styles.barButton}
            onClick={() => setDrawerAt(pathname)}
            aria-label={t('shell.openMenu')}
            aria-expanded={drawerOpen}
            aria-haspopup="dialog"
          >
            <Menu size={22} aria-hidden="true" />
          </button>
          <ShellLogo label={t('shell.home')} size="sm" />
          <span className={styles.barSpacer} />
          <button
            type="button"
            className={`${styles.barButton} ${styles.barSearch}`}
            onClick={(e) => openPalette(e.currentTarget)}
            aria-label={t('shell.search')}
            aria-haspopup="dialog"
          >
            <Search size={20} aria-hidden="true" />
          </button>
        </header>
      )}

      <div className={styles.main}>
        <div className={styles.notices}>
          {org?.trialEndsAt && <TrialNotice trialEndsAt={org.trialEndsAt} />}
          <div className={`gsLegacy ${styles.legacyNotices}`}>
            <SuspendedBanner />
            {usage && (
              <UpgradeBanner
                messagesPercent={usage.messages.percent}
                messagesUsed={usage.messages.used}
                messagesLimit={usage.messages.limit}
              />
            )}
          </div>
        </div>
        <main id="main" className={legacy ? `gsLegacy ${styles.legacyContent}` : styles.content}>
          {children}
        </main>
      </div>

      {!isDesktop && drawerOpen && (
        <div
          className={styles.drawerScrim}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeDrawer();
          }}
        >
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label={t('shell.navLabel')}
            className={styles.drawer}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                // El menú de la cuenta frena su propio Escape: aquí solo llega si no está abierto
                e.preventDefault();
                closeDrawer();
              } else {
                trapTab(e, drawerRef.current);
              }
            }}
          >
            <AppRail
              {...railProps}
              className={styles.drawerRail}
              onNavigate={closeDrawer}
              onOpenPalette={() => {
                setDrawerAt(null);
                openPalette(menuButtonRef.current);
              }}
            />
            <button
              ref={drawerCloseRef}
              type="button"
              className={styles.drawerClose}
              onClick={closeDrawer}
              aria-label={t('shell.closeMenu')}
            >
              <X size={22} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {paletteOpen && (
        <CommandPalette
          onClose={closePalette}
          navigate={navigate}
          theme={theme}
          onToggleTheme={toggleTheme}
          otherLanguage={otherLanguage}
          onToggleLanguage={toggleLanguage}
          onLogout={() => void handleLogout()}
          agents={orgAgents?.agents ?? null}
        />
      )}
    </div>
  );
}

