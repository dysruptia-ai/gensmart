'use client';

import React from 'react';
import { AppLogo, LanguageSwitch, ThemeToggle } from '@/components/app';
import { useTranslation } from '@/hooks/useTranslation';
import { appSiteHref } from '@/lib/app-links';
import AuthPanel from '../AuthPanel/AuthPanel';
import { AuthScreenProvider, useAuthPanel } from '../AuthScreenContext';
import styles from './AuthShell.module.css';

function Shell({ children }: { children: React.ReactNode }) {
  const { t, language } = useTranslation();
  const panel = useAuthPanel();
  return (
    <div className={`gsApp ${styles.shell} ${panel ? '' : styles.solo}`}>
      <div className={styles.formcol}>
        <header className={styles.top}>
          <AppLogo href={appSiteHref('home', language)} label={t('access.shell.home')} />
          <div className={styles.tools}>
            <LanguageSwitch label={t('access.shell.language')} />
            <ThemeToggle toLightLabel={t('access.shell.themeToLight')} toDarkLabel={t('access.shell.themeToDark')} />
          </div>
        </header>
        <main className={styles.view}>{children}</main>
        <footer className={styles.foot}>
          <nav aria-label={t('access.shell.footerNav')}>
            <a href={appSiteHref('terms', language)}>{t('access.shell.terms')}</a>
            <span aria-hidden="true"> · </span>
            <a href={appSiteHref('privacy', language)}>{t('access.shell.privacy')}</a>
            <span aria-hidden="true"> · </span>
            <a href={appSiteHref('help', language)}>{t('access.shell.help')}</a>
          </nav>
          <p>{t('access.shell.rights')}</p>
        </footer>
      </div>
      {panel && <AuthPanel variant={panel} />}
    </div>
  );
}

/** Layout de acceso del diseño 2026: formulario a la izquierda y panel de ejemplo a la derecha. */
export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthScreenProvider>
      <Shell>{children}</Shell>
    </AuthScreenProvider>
  );
}
