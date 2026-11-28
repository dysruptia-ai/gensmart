'use client';

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import styles from './InboxNotice.module.css';

export interface InboxNoticeProps {
  tone: 'warn' | 'bad' | 'info';
  icon: LucideIcon;
  children: React.ReactNode;
  /** Botón o enlace a la derecha. */
  action?: React.ReactNode;
  /** `alert` solo para lo urgente (canal desconectado); el resto, `status`. */
  role?: 'status' | 'alert';
  /** Sin bordes redondeados, a lo ancho (el `banner slim` del diseño, sobre el compositor). */
  slim?: boolean;
  className?: string;
}

/** El `.banner` del diseño (web-45) con los tokens de la app. El color nunca va solo: siempre hay texto. */
export default function InboxNotice({ tone, icon: Icon, children, action, role = 'status', slim, className }: InboxNoticeProps) {
  return (
    <div role={role} className={[styles.notice, styles[tone], slim && styles.slim, className].filter(Boolean).join(' ')}>
      <Icon size={16} aria-hidden="true" className={styles.icon} />
      <span className={styles.text}>{children}</span>
      {action && <span className={styles.action}>{action}</span>}
    </div>
  );
}
