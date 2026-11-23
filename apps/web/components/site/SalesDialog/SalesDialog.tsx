'use client';

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { CheckCircle2, Send, X } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import styles from './SalesDialog.module.css';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? '';
const S = 'site.sales';

type Status = 'idle' | 'sending' | 'success' | 'error';

interface SalesDialogProps {
  open: boolean;
  onClose: () => void;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Diálogo "Hablar con ventas" del sitio público (reemplaza al ContactSalesModal del sitio viejo).
 * Mismo endpoint y campos: POST /api/contact-sales { name, email, company, message }.
 * Se renderiza dentro de SiteRoot para heredar los tokens --gs-*.
 */
export default function SalesDialog({ open, onClose }: SalesDialogProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const descId = useId();
  const fieldId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const doneRef = useRef<HTMLButtonElement>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<Status>('idle');

  // Al abrir: guarda quién tenía el foco, bloquea el scroll del fondo y enfoca el primer campo.
  // Al cerrar: restaura el scroll y devuelve el foco al botón que lo abrió.
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = 'hidden';
    firstFieldRef.current?.focus();
    return () => {
      root.style.overflow = previousOverflow;
      opener?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (status === 'success') doneRef.current?.focus();
  }, [status]);

  if (!open) return null;

  function close() {
    setStatus('idle');
    setName('');
    setEmail('');
    setCompany('');
    setMessage('');
    onClose();
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('sending');
    try {
      const res = await fetch(`${API_BASE}/api/contact-sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, company, message }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus('success');
    } catch {
      setStatus('error');
    }
  }

  // Escape cierra; Tab y Shift+Tab giran dentro del diálogo
  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
      return;
    }
    if (e.key !== 'Tab' || !dialogRef.current) return;
    const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  const required = <span className={styles.req}> *<span className={styles.srOnly}> ({t(`${S}.required`)})</span></span>;

  return (
    <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onKeyDown={handleKeyDown}
      >
        <button type="button" className={styles.close} onClick={close} aria-label={t(`${S}.close`)}>
          <X size={18} aria-hidden="true" />
        </button>

        <h2 id={titleId} className={styles.title}>
          {t(`${S}.title`)}
        </h2>
        <p id={descId} className={styles.subtitle}>
          {t(`${S}.subtitle`)}
        </p>

        {status === 'success' ? (
          <div className={styles.success} role="status">
            <CheckCircle2 size={40} className={styles.successIcon} aria-hidden="true" />
            <p className={styles.successText}>{t(`${S}.success`)}</p>
            <button ref={doneRef} type="button" className={styles.submit} onClick={close}>
              {t(`${S}.done`)}
            </button>
          </div>
        ) : (
          <form className={styles.form} onSubmit={(e) => void handleSubmit(e)}>
            <div className={styles.field}>
              <label htmlFor={`${fieldId}-name`} className={styles.label}>
                {t(`${S}.name`)}
                {required}
              </label>
              <input
                ref={firstFieldRef}
                id={`${fieldId}-name`}
                className={styles.input}
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t(`${S}.namePlaceholder`)}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor={`${fieldId}-email`} className={styles.label}>
                {t(`${S}.email`)}
                {required}
              </label>
              <input
                id={`${fieldId}-email`}
                className={styles.input}
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t(`${S}.emailPlaceholder`)}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor={`${fieldId}-company`} className={styles.label}>
                {t(`${S}.company`)} <span className={styles.optional}>({t(`${S}.optional`)})</span>
              </label>
              <input
                id={`${fieldId}-company`}
                className={styles.input}
                type="text"
                autoComplete="organization"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder={t(`${S}.companyPlaceholder`)}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor={`${fieldId}-message`} className={styles.label}>
                {t(`${S}.message`)}
                {required}
              </label>
              <textarea
                id={`${fieldId}-message`}
                className={styles.input}
                required
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t(`${S}.messagePlaceholder`)}
              />
            </div>

            {status === 'error' ? (
              <p className={styles.error} role="alert">
                {t(`${S}.error`)}
              </p>
            ) : null}

            <button type="submit" className={styles.submit} disabled={status === 'sending'}>
              {status === 'sending' ? (
                t(`${S}.sending`)
              ) : (
                <>
                  <Send size={16} aria-hidden="true" />
                  {t(`${S}.send`)}
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
