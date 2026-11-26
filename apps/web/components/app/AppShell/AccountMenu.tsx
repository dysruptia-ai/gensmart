'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { Languages, LogOut, Shield, UserRound, Users, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTranslation } from '@/hooks/useTranslation';
import { capitalize, initials } from './useShellData';
import styles from './AccountMenu.module.css';

/** "Mi cuenta": no hay pantalla de perfil propia; los ajustes generales tienen el idioma y la organización. */
export const MY_ACCOUNT_HREF = '/dashboard/settings';

interface MenuEntry {
  key: string;
  icon: LucideIcon;
  label: string;
  href?: string;
  onSelect?: () => void;
  dividerBefore?: boolean;
}

export interface AccountMenuProps {
  /** `full`: avatar, nombre y organización (riel completo). `compact`: solo el avatar (riel encogido). */
  variant: 'full' | 'compact';
  plan: string | null;
  onLogout: () => void;
}

export default function AccountMenu({ variant, plan, onLogout }: AccountMenuProps) {
  const { user } = useAuth();
  const { language, setLanguage } = useLanguage();
  const { t } = useTranslation();
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const focusOnOpen = useRef<'first' | 'last'>('first');

  const otherLanguage = language === 'es' ? 'en' : 'es';
  const entries: MenuEntry[] = [
    { key: 'account', icon: UserRound, label: t('shell.account.myAccount'), href: MY_ACCOUNT_HREF },
    { key: 'team', icon: Users, label: t('shell.account.team'), href: '/dashboard/settings/team' },
    {
      key: 'language',
      icon: Languages,
      label: t('shell.account.language', { language: t(`shell.languages.${language}`) }),
      onSelect: () => setLanguage(otherLanguage),
    },
    ...(user?.isSuperAdmin
      ? [{ key: 'admin', icon: Shield, label: t('shell.account.admin'), href: '/admin' }]
      : []),
    { key: 'logout', icon: LogOut, label: t('shell.account.logout'), onSelect: onLogout, dividerBefore: true },
  ];

  function menuItems(): HTMLElement[] {
    return Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
  }

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const items = menuItems();
    (focusOnOpen.current === 'last' ? items[items.length - 1] : items[0])?.focus();
    function onPointer(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open]);

  function onButtonKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      focusOnOpen.current = e.key === 'ArrowUp' ? 'last' : 'first';
      setOpen(true);
    }
  }

  function onMenuKey(e: React.KeyboardEvent) {
    const items = menuItems();
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close(true);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      items[(index + step + items.length) % items.length]?.focus();
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      (e.key === 'Home' ? items[0] : items[items.length - 1])?.focus();
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  }

  function select(entry: MenuEntry) {
    if (entry.onSelect) {
      // El idioma se queda en el menú: el usuario ve el cambio y sigue donde estaba
      if (entry.key === 'language') {
        entry.onSelect();
        return;
      }
      close(false);
      entry.onSelect();
    }
  }

  const orgLine = user
    ? plan
      ? t('shell.account.orgPlan', { org: user.orgName, plan: capitalize(plan) })
      : user.orgName
    : '';

  return (
    <div ref={rootRef} className={`${styles.root} ${variant === 'compact' ? styles.compact : ''}`}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={variant === 'compact' ? `${t('shell.account.open')}: ${user?.name ?? ''}` : undefined}
        onClick={() => {
          focusOnOpen.current = 'first';
          setOpen((v) => !v);
        }}
        onKeyDown={onButtonKey}
      >
        <span className={styles.avatar} aria-hidden="true">{initials(user?.name)}</span>
        {variant === 'full' && (
          <span className={styles.who}>
            <b className={styles.name}>{user?.name}</b>
            <span className={styles.org}>{user?.orgName}</span>
          </span>
        )}
      </button>

      {open && (
        <div ref={menuRef} id={menuId} role="menu" aria-label={t('shell.account.open')} className={styles.menu} onKeyDown={onMenuKey}>
          <div className={styles.head}>
            <b>{user?.name}</b>
            <span>{user?.email}</span>
            <span>{orgLine}</span>
          </div>
          {entries.map((entry) => {
            const Icon = entry.icon;
            const content = (
              <>
                <Icon size={16} aria-hidden="true" />
                {entry.label}
              </>
            );
            return (
              <React.Fragment key={entry.key}>
                {entry.dividerBefore && <div className={styles.divider} role="separator" />}
                {entry.href ? (
                  <Link
                    href={entry.href}
                    role="menuitem"
                    tabIndex={-1}
                    className={styles.item}
                    onClick={() => close(false)}
                  >
                    {content}
                  </Link>
                ) : (
                  <button
                    type="button"
                    role="menuitem"
                    tabIndex={-1}
                    className={styles.item}
                    onClick={() => select(entry)}
                  >
                    {content}
                  </button>
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}
