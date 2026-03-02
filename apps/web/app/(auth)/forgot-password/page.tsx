'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Mail, ArrowLeft } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Logo } from '@/components/ui/Logo';
import { useTranslation } from '@/hooks/useTranslation';
import styles from '../auth.module.css';

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/api/auth/forgot-password', { email });
      setSubmitted(true);
    } catch (err) {
      // Always show generic success to prevent email enumeration
      if (err instanceof ApiError && err.status >= 500) {
        setError(t('errors.somethingWentWrong'));
      } else {
        setSubmitted(true);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.logoCenter}>
        <Logo size="lg" href="/" />
      </div>

      <h1 className={styles.heading}>{t('auth.forgotPassword.title')}</h1>
      <p className={styles.subheading}>{t('auth.forgotPassword.subtitle')}</p>

      {submitted ? (
        <div className={styles.successBanner} role="status">
          {t('auth.forgotPassword.successMessage')}
        </div>
      ) : (
        <>
          {error && (
            <div className={styles.errorBanner} role="alert">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className={styles.form}>
            <Input
              label={t('auth.forgotPassword.email')}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              autoFocus
              required
              icon={Mail}
            />
            <Button type="submit" fullWidth loading={loading}>
              {t('auth.forgotPassword.submit')}
            </Button>
          </form>
        </>
      )}

      <p className={styles.footer}>
        <Link href="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
          <ArrowLeft size={14} /> {t('auth.forgotPassword.backToLogin')}
        </Link>
      </p>
    </div>
  );
}
