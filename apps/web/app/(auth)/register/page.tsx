'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Lock, User, Building2, AlertCircle, Tag } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ApiError } from '@/lib/api';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Logo } from '@/components/ui/Logo';
import { useToast } from '@/components/ui/Toast';
import { useTranslation } from '@/hooks/useTranslation';
import styles from '../auth.module.css';

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const codeFromUrl = searchParams.get('code') || '';
  const { register } = useAuth();
  const { success } = useToast();
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validateForm(name, email, orgName, password, confirmPassword);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    setLoading(true);
    try {
      await register(email, password, name, orgName, promoCode || undefined);
      if (promoCode) {
        success('Pro trial activated!', 'You have 30 days of Pro features. Enjoy!');
      } else {
        success('Account created!', 'Welcome to GenSmart. Setting up your dashboard…');
      }
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('errors.generic'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.container}>
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
