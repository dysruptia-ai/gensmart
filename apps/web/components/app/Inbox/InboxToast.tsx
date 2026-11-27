'use client';

import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import styles from './InboxToast.module.css';

export interface ToastData {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
}

export interface InboxToastProps {
  toast: ToastData | null;
  onDismiss: () => void;
}

/** Aviso corto de la Bandeja (web-44): "Vista guardada en el riel", "Marcada como no leída" con "Deshacer"… */
export default function InboxToast({ toast, onDismiss }: InboxToastProps) {
  const { t } = useTranslation();
  const dismissRef = useRef(onDismiss);
  useLayoutEffect(() => {
    dismissRef.current = onDismiss;
  });

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => dismissRef.current(), toast.action ? 7000 : 4500);
    return () => clearTimeout(id);
  }, [toast]);

  return (
    <div className={styles.region} role="status" aria-live="polite">
      {toast && (
        <div key={toast.id} className={styles.toast}>
          <span className={styles.text}>{toast.text}</span>
          {toast.action && (
            <button
              type="button"
              className={styles.action}
              onClick={() => {
                toast.action?.run();
                onDismiss();
              }}
            >
              {toast.action.label}
            </button>
          )}
          <button type="button" className={styles.close} onClick={onDismiss} aria-label={t('inbox.toast.dismiss')}>
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
