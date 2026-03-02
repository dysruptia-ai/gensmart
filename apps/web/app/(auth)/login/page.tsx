'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Lock, ArrowLeft, ShieldCheck, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ApiError } from '@/lib/api';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Logo } from '@/components/ui/Logo';
import { useTranslation } from '@/hooks/useTranslation';
import styles from '../auth.module.css';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, verify2FA } = useAuth();
  const { t } = useTranslation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const from = searchParams.get('from') ?? '/dashboard';

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result.requires2FA && result.tempToken) {
        setTempToken(result.tempToken);
      } else {
        router.replace(from);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('errors.generic'));
    } finally {
      setLoading(false);
    }
  }

  async function handle2FA(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await verify2FA(tempToken!, totpCode);
      router.replace(from);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.twoFactor.invalidCode'));
    } finally {
      setLoading(false);
    }
  }

  if (tempToken) {
    return (
      <div className={styles.container}>
        <div className={styles.logoCenter}>
          <Logo size="lg" href="/" />
        </div>

        <div className={styles.twoFAWrapper}>
          <ShieldCheck size={40} color="var(--color-primary)" aria-hidden="true" />
          <h2 className={styles.twoFATitle} style={{ marginTop: '0.75rem' }}>
            {t('auth.twoFactor.title')}
          </h2>
          <p className={styles.twoFADesc}>
            {t('auth.twoFactor.subtitle')}
          </p>
        </div>

        {error && (
          <div className={styles.errorBanner} role="alert">
            <AlertCircle size={14} aria-hidden="true" />
            {error}
          </div>
        )}

        <form onSubmit={handle2FA} className={styles.form}>
          <Input
            label={t('auth.twoFactor.code')}
            value={totpCode}
            onChange={(e) => setTotpCode(e.target.value)}
            placeholder="000000"
            maxLength={8}
            autoComplete="one-time-code"
            autoFocus
            icon={ShieldCheck}
          />
          <Button type="submit" fullWidth loading={loading}>
            {t('auth.twoFactor.submit')}
          </Button>
        </form>

        <div className={styles.footer}>
          <button
            className={styles.backLink}
            onClick={() => { setTempToken(null); setTotpCode(''); setError(''); }}
          >
            <ArrowLeft size={14} /> {t('auth.twoFactor.backToLogin')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.logoCenter}>
        <Logo size="lg" href="/" />
      </div>

      <h1 className={styles.heading}>{t('auth.login.subtitle')}</h1>
      <p className={styles.subheading}>{t('auth.login.title')}</p>

      {error && (
        <div className={styles.errorBanner} role="alert">
          <AlertCircle size={14} aria-hidden="true" />
          {error}
        </div>
      )}

      <form onSubmit={handleLogin} className={styles.form}>
        <Input
          label={t('auth.login.email')}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          autoFocus
          required
          icon={Mail}
        />
        <Input
          label={t('auth.login.password')}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="current-password"
          required
          icon={Lock}
        />
        <Link href="/forgot-password" className={styles.forgotLink}>
          {t('auth.login.forgotPassword')}
        </Link>
        <Button type="submit" fullWidth loading={loading}>
          {t('auth.login.submit')}
        </Button>
      </form>

      <p className={styles.footer}>
        {t('auth.login.noAccount')}{' '}
        <Link href="/register">{t('auth.login.register')}</Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className={styles.container} />}>
      <LoginForm />
    </Suspense>
  );
}
