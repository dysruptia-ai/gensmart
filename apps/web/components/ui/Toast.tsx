'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import styles from './Toast.module.css';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextValue {
  toast: (item: Omit<ToastItem, 'id'>) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastType, React.ElementType> = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((item: Omit<ToastItem, 'id'>) => {
    const id = Math.random().toString(36).slice(2);
    const duration = item.duration ?? 5000;
    setToasts((prev) => [...prev, { ...item, id }]);
    setTimeout(() => removeToast(id), duration);
  }, [removeToast]);

  const ctx: ToastContextValue = {
    toast: addToast,
    success: (title, message) => addToast({ type: 'success', title, message }),
    error: (title, message) => addToast({ type: 'error', title, message }),
    warning: (title, message) => addToast({ type: 'warning', title, message }),
    info: (title, message) => addToast({ type: 'info', title, message }),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <div className={styles.container} aria-live="polite" aria-label="Notifications">
        {toasts.map((t) => {
          const Icon = ICONS[t.type];
          const duration = t.duration ?? 5000;
          return (
            <div key={t.id} className={[styles.toast, styles[t.type]].join(' ')}>
              <div
                className={styles.toastInner}
                style={{ minWidth: 0, maxWidth: '100%', padding: 0, border: 'none', boxShadow: 'none', background: 'transparent', animation: 'none' }}
              >
                <span className={styles.iconWrap}>
                  <Icon size={18} aria-hidden="true" />
                </span>
                <div className={styles.content}>
                  <div className={styles.title}>{t.title}</div>
                  {t.message && <div className={styles.message}>{t.message}</div>}
                </div>
                <button
                  type="button"
                  className={styles.closeBtn}
                  onClick={() => removeToast(t.id)}
                  aria-label="Dismiss notification"
                >
                  <X size={16} />
                </button>
                <div
                  className={styles.progressBar}
                  style={{ animationDuration: `${duration}ms` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export default ToastProvider;
