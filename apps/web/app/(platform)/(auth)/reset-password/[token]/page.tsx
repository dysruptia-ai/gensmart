'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { Lock, AlertCircle, ArrowLeft } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Logo } from '@/components/ui/Logo';
import { useTranslation } from '@/hooks/useTranslation';
import styles from '../../auth.module.css';

export default function ResetPasswordPage() {
  const router = useRouter();
  const params = useParams();
  const token = params['token'] as string;
  const { t } = useTranslation();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError(t('errors.passwordTooShort'));
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setError(t('errors.passwordNeedsUppercase'));
      return;
    }
    if (!/[0-9]/.test(password)) {
      setError(t('errors.passwordNeedsNumber'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('errors.passwordsNotMatch'));
      return;
    }
    setError('');
    setLoading(true);
    try {
      await api.post('/api/auth/reset-password', { token, password });
      router.replace('/login?reset=1');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'INVALID_RESET_TOKEN') {
          setError(t('errors.invalidResetToken'));
        } else {
          setError(err.message);
        }
      } else {
        setError(t('errors.somethingWentWrong'));
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

      <h1 className={styles.heading}>{t('auth.resetPassword.title')}</h1>
      <p className={styles.subheading}>{t('auth.resetPassword.subtitle')}</p>

      {error && (
        <div className={styles.errorBanner} role="alert">
          <AlertCircle size={14} aria-hidden="true" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className={styles.form}>
        <Input
          label={t('auth.resetPassword.password')}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Min 8 chars, 1 uppercase, 1 number"
          autoComplete="new-password"
          autoFocus
          required
          icon={Lock}
        />
        <Input
          label={t('auth.resetPassword.confirmPassword')}
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="new-password"
          required
          icon={Lock}
        />
        <Button type="submit" fullWidth loading={loading}>
          {t('auth.resetPassword.submit')}
        </Button>
      </form>

      <p className={styles.footer}>
        <Link href="/forgot-password" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
          <ArrowLeft size={14} /> {t('auth.forgotPassword.backToLogin')}
        </Link>
      </p>
    </div>
  );
}
