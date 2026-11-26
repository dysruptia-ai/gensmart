'use client';

import React from 'react';
import { getNavItem, type AppNavItemId } from '@/lib/app-nav';
import { useTranslation } from '@/hooks/useTranslation';
import PageHeader from '../PageHeader/PageHeader';
import styles from './PendingScreen.module.css';

/** Pantalla del menú que todavía no existe: la cabecera y un estado vacío, sin prometer funciones. */
export default function PendingScreen({ id }: { id: AppNavItemId }) {
  const { t } = useTranslation();
  const item = getNavItem(id);
  const Icon = item.icon;
  return (
    <>
      <PageHeader title={t(item.labelKey)} subtitle={t(item.subtitleKey)} />
      <div className={styles.body}>
        <div className={styles.empty}>
          <span className={styles.icon} aria-hidden="true">
            <Icon size={22} />
          </span>
          <p className={styles.title}>{t('shell.pending.title')}</p>
        </div>
      </div>
    </>
  );
}
