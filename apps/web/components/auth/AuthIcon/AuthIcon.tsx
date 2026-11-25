import React from 'react';
import type { LucideIcon } from 'lucide-react';
import styles from './AuthIcon.module.css';

export interface AuthIconProps {
  icon: LucideIcon;
  tone?: 'ok' | 'err';
}

/** Ícono grande sobre el título de las pantallas de apoyo ("Revisa tu correo", enlace vencido). */
export default function AuthIcon({ icon: Icon, tone = 'ok' }: AuthIconProps) {
  return (
    <div className={`${styles.icon} ${styles[tone]}`} aria-hidden="true">
      <Icon size={28} strokeWidth={1.8} />
    </div>
  );
}
