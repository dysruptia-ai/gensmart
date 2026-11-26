'use client';

import React, { useEffect, useId, useLayoutEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { trapTab } from '@/lib/focus-trap';
import { useTranslation } from '@/hooks/useTranslation';
import styles from './InboxDialog.module.css';

export interface InboxDialogProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Elemento que recibe el foco al abrir (por defecto, el primero que se puede enfocar). */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
}

/** Cuadro de diálogo dentro de la página (nunca `confirm()`): atrapa el foco, Escape cierra y devuelve el foco. */
export default function InboxDialog({ title, onClose, children, footer, initialFocusRef }: InboxDialogProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useLayoutEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const target = initialFocusRef?.current ?? boxRef.current?.querySelector<HTMLElement>('[data-autofocus]') ?? boxRef.current;
    target?.focus();
    return () => {
      if (opener && opener.isConnected) opener.focus();
    };
  }, [initialFocusRef]);

  return (
    <div
      className={styles.scrim}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeRef.current();
      }}
    >
      <div
        ref={boxRef}
        className={styles.box}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            closeRef.current();
          } else {
            trapTab(e, boxRef.current);
          }
        }}
      >
        <header className={styles.head}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label={t('inbox.dialog.close')}>
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className={styles.body}>{children}</div>
        {footer && <footer className={styles.foot}>{footer}</footer>}
      </div>
    </div>
  );
}
