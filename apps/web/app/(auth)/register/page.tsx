'use client';

import React, { useState, useRef, Suspense } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import { useSearchParams } from 'next/navigation';
import { Mail, Lock, User, Building2, AlertCircle, Tag } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ApiError } from '@/lib/api';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Logo } from '@/components/ui/Logo';
import { useTranslation } from '@/hooks/useTranslation';
import styles from '../auth.module.css';

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId?: string) => void;
    };
  }
}

function useValidateForm() {
  const { t } = useTranslation();

  return (
    name: string,
    email: string,
    orgName: string,
    password: string,
    confirmPassword: string
  ): string => {
    if (!name.trim() || name.length < 2) return t('errors.nameTooShort');
    if (!email.includes('@')) return t('errors.invalidEmail');
    if (!orgName.trim() || orgName.length < 2) return t('errors.orgNameTooShort');
    if (password.length < 8) return t('errors.passwordTooShort');
    if (!/[A-Z]/.test(password)) return t('errors.passwordNeedsUppercase');
    if (!/[0-9]/.test(password)) return t('errors.passwordNeedsNumber');
    if (password !== confirmPassword) return t('errors.passwordsNotMatch');
    return '';
  };
}

function RegisterForm() {
  const searchParams = useSearchParams();
  const codeFromUrl = searchParams.get('code') || '';
  const { register } = useAuth();
  const { t } = useTranslation();
  const validateForm = useValidateForm();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [orgName, setOrgName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [promoCode, setPromoCode] = useState(codeFromUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const captchaRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | undefined>(undefined);

  function renderTurnstile() {
    if (!captchaRef.current || !window.turnstile || widgetIdRef.current) return;
    widgetIdRef.current = window.turnstile.render(captchaRef.current, {
      sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
      callback: (token: string) => setTurnstileToken(token),
      'error-callback': () => setTurnstileToken(''),
      'expired-callback': () => setTurnstileToken(''),
    });
  }

  // A Turnstile token is single-use: after any failed submit the widget must issue a new one
  function resetTurnstile() {
    if (window.turnstile && widgetIdRef.current) window.turnstile.reset(widgetIdRef.current);
    setTurnstileToken('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validateForm(name, email, orgName, password, confirmPassword);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!turnstileToken) {
      setError(t('errors.captchaFailed'));
      return;
    }
    setError('');
    setLoading(true);
    try {
      const result = await register(email, password, name, orgName, turnstileToken, promoCode || undefined);
      setPromoApplied(result.promoApplied);
      setRegisteredEmail(result.email);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('errors.generic'));
      resetTurnstile();
    } finally {
      setLoading(false);
    }
  }

  if (registeredEmail) {
    return (
      <div className={styles.container}>
        <div className={styles.logoCenter}>
          <Logo size="lg" href="/" />
        </div>
        <div className={styles.twoFAWrapper}>
          <Mail size={40} color="var(--color-primary)" aria-hidden="true" />
          <h2 className={styles.twoFATitle} style={{ marginTop: '0.75rem' }}>
            {t('auth.register.checkEmailTitle')}
          </h2>
          <p className={styles.twoFADesc}>{t('auth.register.checkEmailSubtitle')}</p>
        </div>
        {promoApplied && (
          <div className={styles.successBanner} role="status">
            {t('auth.register.promoActivatedPendingVerification')}
          </div>
        )}
        <p className={styles.footer}>
          <Link href="/login">{t('auth.register.login')}</Link>
        </p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="afterInteractive"
        onReady={renderTurnstile}
      />
      <div className={styles.logoCenter}>
        <Logo size="lg" href="/" />
      </div>

      <h1 className={styles.heading}>{t('auth.register.title')}</h1>
      <p className={styles.subheading}>{t('auth.register.subtitle')}</p>

      {error && (
        <div className={styles.errorBanner} role="alert">
          <AlertCircle size={14} aria-hidden="true" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className={styles.form}>
        <Input
          label={t('auth.register.name')}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jane Smith"
          autoComplete="name"
          autoFocus
          required
          icon={User}
        />
        <Input
          label={t('auth.register.email')}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          required
          icon={Mail}
        />
        <Input
          label={t('auth.register.orgName')}
          type="text"
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          placeholder="Acme Corp"
          autoComplete="organization"
          required
          icon={Building2}
        />
        <Input
          label={t('auth.register.password')}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Min 8 chars, 1 uppercase, 1 number"
          autoComplete="new-password"
          required
          icon={Lock}
        />
        <Input
          label={t('auth.register.confirmPassword')}
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="new-password"
          required
          icon={Lock}
        />
        <Input
          label="Promo Code (optional)"
          type="text"
          value={promoCode}
          onChange={(e) => setPromoCode(e.target.value)}
          placeholder="Enter promo code"
          icon={Tag}
        />
        <div ref={captchaRef} className={styles.captchaWrapper} />
        <Button type="submit" fullWidth loading={loading}>
          {t('auth.register.submit')}
        </Button>
      </form>

      <p className={styles.footer}>
        {t('auth.register.hasAccount')}{' '}
        <Link href="/login">{t('auth.register.login')}</Link>
      </p>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
