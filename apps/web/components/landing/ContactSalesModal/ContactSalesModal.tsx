'use client';

import React, { useState } from 'react';
import { X, Send, CheckCircle } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import styles from './ContactSalesModal.module.css';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? '';

interface ContactSalesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ContactSalesModal({ isOpen, onClose }: ContactSalesModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('loading');
    try {
      const res = await fetch(`${API_BASE}/api/contact-sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, company, message }),
      });
      if (!res.ok) throw new Error('Failed');
      setStatus('success');
    } catch {
      setStatus('error');
    }
  }

  function handleClose() {
    setStatus('idle');
    setName('');
    setEmail('');
    setCompany('');
    setMessage('');
    onClose();
  }

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={handleClose} type="button" aria-label="Close">
          <X size={18} />
        </button>

        <h2 className={styles.title}>{t('contactSales.title')}</h2>
        <p className={styles.subtitle}>{t('contactSales.subtitle')}</p>

        {status === 'success' ? (
          <div className={styles.successState}>
            <CheckCircle size={40} className={styles.successIcon} />
            <p className={styles.successMsg}>{t('contactSales.success')}</p>
            <button className={styles.doneBtn} onClick={handleClose} type="button">
              {t('common.close')}
            </button>
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className={styles.form}>
            <div className={styles.field}>
              <label htmlFor="cs-name" className={styles.label}>{t('common.name')} *</label>
              <input
                id="cs-name"
                className={styles.input}
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('contactSales.namePlaceholder')}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="cs-email" className={styles.label}>{t('common.email')} *</label>
              <input
                id="cs-email"
                className={styles.input}
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('contactSales.emailPlaceholder')}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="cs-company" className={styles.label}>
                {t('contactSales.company')} <span className={styles.optional}>({t('common.optional')})</span>
              </label>
              <input
                id="cs-company"
                className={styles.input}
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder={t('contactSales.companyPlaceholder')}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="cs-message" className={styles.label}>{t('contactSales.message')} *</label>
              <textarea
                id="cs-message"
                className={styles.textarea}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t('contactSales.messagePlaceholder')}
                rows={4}
              />
            </div>

            {status === 'error' && (
              <p className={styles.errorMsg}>{t('common.error')}</p>
            )}

            <button
              className={styles.submitBtn}
              type="submit"
              disabled={status === 'loading'}
            >
              {status === 'loading' ? t('common.loading') : (
                <>
                  <Send size={14} />
                  {t('contactSales.send')}
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
