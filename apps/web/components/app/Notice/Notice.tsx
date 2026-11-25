import React from 'react';
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import styles from './Notice.module.css';

export type NoticeKind = 'error' | 'success' | 'info' | 'warning';

export interface NoticeProps {
  kind: NoticeKind;
  children: React.ReactNode;
  /** Acción a la derecha (por ejemplo "Reenviar enlace"). */
  action?: React.ReactNode;
  className?: string;
  id?: string;
}

const ICONS = { error: AlertCircle, success: CheckCircle2, info: Info, warning: TriangleAlert } as const;

/**
 * Aviso de error, éxito, información o advertencia. Los errores y advertencias se anuncian
 * de inmediato (`role="alert"`); éxito e información, con cortesía (`role="status"`).
 */
export default function Notice({ kind, children, action, className, id }: NoticeProps) {
  const Icon = ICONS[kind];
  const urgent = kind === 'error' || kind === 'warning';
  return (
    <div id={id} className={[styles.notice, styles[kind], className].filter(Boolean).join(' ')} role={urgent ? 'alert' : 'status'}>
      <Icon className={styles.icon} size={18} aria-hidden="true" />
      <span className={styles.text}>{children}</span>
      {action && <span className={styles.action}>{action}</span>}
    </div>
  );
}
