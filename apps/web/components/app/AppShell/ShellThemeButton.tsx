'use client';

import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useAppTheme } from '@/lib/app-theme';
import { useTranslation } from '@/hooks/useTranslation';
import styles from './ShellThemeButton.module.css';

/** Botón de tema del pie del riel: sol en oscuro, luna en claro. */
export default function ShellThemeButton() {
  const { theme, setTheme } = useAppTheme();
  const { t } = useTranslation();
  const dark = theme === 'dark';
  const label = dark ? t('shell.toLight') : t('shell.toDark');
  return (
    <button type="button" className={styles.button} onClick={() => setTheme(dark ? 'light' : 'dark')} aria-label={label} title={label}>
      {dark ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
    </button>
  );
}
