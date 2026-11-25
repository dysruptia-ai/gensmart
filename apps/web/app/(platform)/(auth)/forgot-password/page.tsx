'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Mail } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';
import { AppButton, Notice, TextField } from '@/components/app';
import { AuthHeading, AuthIcon, useAuthScreen } from '@/components/auth';
import { EMAIL_RE, isNetworkError, isRateLimited } from '@/components/auth/authForm';
import s from '@/components/auth/auth-screens.module.css';

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [error, setError] = useState<'' | 'generic' | 'network' | 'locked'>('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  useAuthScreen({ title: sent ? t('access.forgot.sentTitle') : t('access.meta.forgot'), panel: null });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setFieldError(t('access.errors.email'));
      emailRef.current?.focus();
      return;
    }
    setFieldError('');
    setError('');
    setLoading(true);
    try {
      await api.post('/api/auth/forgot-password', { email: trimmed });
      setSent(true);
    } catch (err) {
      // Nunca se revela si el correo existe: solo un fallo del servidor o de red cambia la respuesta
      // El límite es por IP (no por correo): avisarlo no revela nada
      if (isNetworkError(err)) setError('network');
      else if (isRateLimited(err)) setError('locked');
      else if (err instanceof ApiError && err.status >= 500) setError('generic');
      else setSent(true);
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <>
        <AuthIcon icon={Mail} />
        <AuthHeading key="sent" title={t('access.forgot.sentTitle')} subtitle={t('access.forgot.sentSubtitle')} />
        <AppButton variant="secondary" onClick={() => setSent(false)}>
          {t('access.forgot.other')}
        </AppButton>
        <p className={s.alt}>
          <Link href="/login">{t('access.forgot.back')}</Link>
        </p>
      </>
    );
  }

  return (
    <>
      <div className={s.back}>
        <Link href="/login" className={s.backLink}>
          <ArrowLeft size={16} aria-hidden="true" />
          {t('access.forgot.back')}
        </Link>
      </div>
      <AuthHeading key="form" title={t('access.forgot.title')} subtitle={t('access.forgot.subtitle')} />
      {error === 'locked' && <Notice kind="error">{t('access.login.locked')}</Notice>}
      {error === 'network' && <Notice kind="error">{t('access.errors.network')}</Notice>}
      {error === 'generic' && <Notice kind="error">{t('access.errors.generic')}</Notice>}
      <form onSubmit={handleSubmit} noValidate>
        <TextField
          label={t('access.field.email')}
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={t('access.field.emailPh')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldError}
          inputRef={emailRef}
          required
        />
        <AppButton type="submit" loading={loading}>
          {t('access.forgot.submit')}
        </AppButton>
      </form>
    </>
  );
}
