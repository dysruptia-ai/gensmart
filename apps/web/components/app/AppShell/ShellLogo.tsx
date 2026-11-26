import React from 'react';
import Link from 'next/link';
import styles from './ShellLogo.module.css';

export interface ShellLogoProps {
  label: string;
  /** `full`: "GenSmart"; `mark`: solo la "G" (riel encogido). */
  variant?: 'full' | 'mark';
  size?: 'md' | 'sm';
  onNavigate?: () => void;
}

/** Logo de texto del shell (Handjet): "Gen" con la tinta del tema y "Smart" en verde. */
export default function ShellLogo({ label, variant = 'full', size = 'md', onNavigate }: ShellLogoProps) {
  return (
    <Link
      href="/dashboard"
      aria-label={label}
      className={`${styles.logo} ${size === 'sm' ? styles.sm : ''}`}
      onClick={onNavigate}
    >
      {variant === 'mark' ? (
        <span className={styles.smart} aria-hidden="true">G</span>
      ) : (
        <span aria-hidden="true">
          <span className={styles.gen}>Gen</span>
          <span className={styles.smart}>Smart</span>
        </span>
      )}
    </Link>
  );
}
