'use client';

import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useAppTheme } from '@/lib/app-theme';
import styles from './ThemeToggle.module.css';

export interface ThemeToggleProps {
  toLightLabel: string;
  toDarkLabel: string;
}

/**
 * Botón luna/sol. Guarda la elección (lib/app-theme.ts); sin elección manda el sistema.
 * Antes de hidratar no se sabe el tema: los dos íconos se resuelven por CSS.
 */
export default function ThemeToggle({ toLightLabel, toDarkLabel }: ThemeToggleProps) {
  const { theme, setTheme } = useAppTheme();
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      className={styles.toggle}
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      aria-label={dark ? toLightLabel : toDarkLabel}
      title={dark ? toLightLabel : toDarkLabel}
    >
      <Moon className={styles.moon} size={18} aria-hidden="true" />
      <Sun className={styles.sun} size={18} aria-hidden="true" />
    </button>
  );
}
