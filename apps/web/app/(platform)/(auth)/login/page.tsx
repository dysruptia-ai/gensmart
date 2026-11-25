'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useAuth, type AuthUser } from '@/contexts/AuthContext';
import { api, ApiError } from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';
import { AppButton, CodeInput, Notice, PasswordField, TextButton, TextField } from '@/components/app';
import { AuthDivider, AuthHeading, OAuthButton, useAuthScreen } from '@/components/auth';
import { useOAuthReturn } from '@/components/auth/useOAuthReturn';
import { oauthStartHref, type OAuthErrorCode } from '@/lib/oauth-links';
import { EMAIL_RE, afterLoginHref, isNetworkError, isRateLimited, safeFrom } from '@/components/auth/authForm';
import s from '@/components/auth/auth-screens.module.css';

type LoginError = '' | 'bad' | 'unverified' | 'locked' | 'generic' | 'network';

function LoginScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, verify2FA } = useAuth();
  const { t, language } = useTranslation();
  const from = safeFrom(searchParams.get('from'));
  const justReset = searchParams.get('reset') === '1';
  const oauthReturnError = useOAuthReturn(searchParams);
  const g2fa = searchParams.get('g2fa');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [error, setError] = useState<LoginError>('');
  const [loading, setLoading] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [resend, setResend] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [oauthError, setOauthError] = useState<OAuthErrorCode | null>(oauthReturnError);
  const handoffStarted = useRef(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useAuthScreen({
    title: tempToken ? t('access.meta.twoFactor') : t('access.meta.login'),
    panel: tempToken ? null : 'login',
  });

  // Volvió de Google con 2FA activo: la URL trae un identificador de un solo uso que la API cambia
  // por el tempToken. Se quita de la URL para que recargar no lo reintente.
  useEffect(() => {
    if (!g2fa || handoffStarted.current) return;
    handoffStarted.current = true;
    const params = new URLSearchParams(searchParams.toString());
    params.delete('g2fa');
    params.delete('lang');
    router.replace(params.size ? `/login?${params.toString()}` : '/login');
    api
      .post<{ tempToken: string }>('/api/auth/oauth/2fa-handoff', { handle: g2fa })
      .then((r) => setTempToken(r.tempToken))
      .catch(() => setOauthError('expired'));
  }, [g2fa, router, searchParams]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    const errs: { email?: string; password?: string } = {};
    if (!EMAIL_RE.test(trimmed)) errs.email = t('access.errors.email');
    if (!password) errs.password = t('access.errors.password');
    setFieldErrors(errs);
    if (errs.email) return emailRef.current?.focus();
    if (errs.password) return passwordRef.current?.focus();

    setError('');
    setOauthError(null);
    setResend('idle');
    setLoading(true);
    try {
      const result = await login(trimmed, password);
      if (result.requires2FA && result.tempToken) {
        setTempToken(result.tempToken);
      } else {
        router.replace(afterLoginHref(from, result.user?.welcomeSurvey));
        return;
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === 'EMAIL_NOT_VERIFIED') {
        setUnverifiedEmail(trimmed);
        setError('unverified');
      } else if (isRateLimited(err)) {
        setError('locked');
      } else if (err instanceof ApiError && (err.code === 'INVALID_CREDENTIALS' || err.status === 401)) {
        setError('bad');
        passwordRef.current?.focus();
      } else {
        setError(isNetworkError(err) ? 'network' : 'generic');
      }
    }
    setLoading(false);
  }

  async function handleResend() {
    setResend('sending');
    try {
      await api.post('/api/auth/resend-verification', { email: unverifiedEmail });
      setResend('sent');
    } catch {
      // La API siempre responde 200 con un mensaje genérico: un error aquí es de red
      setResend('idle');
      setError('network');
    }
  }

  if (tempToken) {
    return (
      <TwoFactorStep
        tempToken={tempToken}
        onBack={() => {
          setTempToken(null);
          setPassword('');
          setError('');
        }}
        onDone={(user) => router.replace(afterLoginHref(from, user.welcomeSurvey))}
        verify2FA={verify2FA}
      />
    );
  }

  return (
    <>
      <AuthHeading key="login" title={t('access.login.title')} subtitle={t('access.login.subtitle')} />

      {justReset && !error && <Notice kind="success">{t('access.login.resetDone')}</Notice>}
      {error === 'bad' && <Notice kind="error">{t('access.login.badCredentials')}</Notice>}
      {error === 'locked' && <Notice kind="error">{t('access.login.locked')}</Notice>}
      {error === 'generic' && <Notice kind="error">{t('access.errors.generic')}</Notice>}
      {error === 'network' && <Notice kind="error">{t('access.errors.network')}</Notice>}
      {error === 'unverified' &&
        (resend === 'sent' ? (
          <Notice kind="success">{t('access.login.resent')}</Notice>
        ) : (
          <Notice
            kind="warning"
            action={
              <button type="button" onClick={handleResend} disabled={resend === 'sending'} aria-busy={resend === 'sending' || undefined}>
                {t('access.login.resend')}
              </button>
            }
          >
            {t('access.login.unverified')}
          </Notice>
        ))}

      {oauthError && <Notice kind="error">{t(`access.oauth.errors.${oauthError}`)}</Notice>}

      <OAuthButton
        provider="google"
        href={oauthStartHref('google', { intent: 'login', lang: language, from })}
        label={t('access.oauth.google')}
        redirectingLabel={t('access.oauth.redirecting')}
      />
      <AuthDivider>{t('access.oauth.orEmail')}</AuthDivider>

      <form onSubmit={handleLogin} noValidate>
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
          error={fieldErrors.email}
          inputRef={emailRef}
          required
        />
        <PasswordField
          label={t('access.field.password')}
          labelAside={
            <Link href="/forgot-password" className={s.forgot}>
              {t('access.login.forgot')}
            </Link>
          }
          name="password"
          autoComplete="current-password"
          placeholder={t('access.field.passwordPh')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
          inputRef={passwordRef}
          showLabel={t('access.field.show')}
          hideLabel={t('access.field.hide')}
          showAria={t('access.field.showPassword')}
          hideAria={t('access.field.hidePassword')}
          required
        />
        <AppButton type="submit" loading={loading}>
          {t('access.login.submit')}
        </AppButton>
      </form>

      <p className={s.alt}>
        {t('access.login.noAccount')} <Link href="/register">{t('access.login.createAccount')}</Link>
      </p>
    </>
  );
}

interface TwoFactorStepProps {
  tempToken: string;
  onBack: () => void;
  onDone: (user: AuthUser) => void;
  verify2FA: (tempToken: string, code: string) => Promise<AuthUser>;
}

function TwoFactorStep({ tempToken, onBack, onDone, verify2FA }: TwoFactorStepProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'app' | 'backup'>('app');
  const [code, setCode] = useState('');
  const [backup, setBackup] = useState('');
  const [error, setError] = useState<'' | 'invalid' | 'incomplete' | 'backupEmpty' | 'locked' | 'network'>('');
  const [loading, setLoading] = useState(false);
  const firstDigitRef = useRef<HTMLInputElement | null>(null);
  const backupRef = useRef<HTMLInputElement>(null);

  async function submit(value: string) {
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      onDone(await verify2FA(tempToken, value));
      return;
    } catch (err) {
      if (isRateLimited(err)) setError('locked');
      else if (isNetworkError(err)) setError('network');
      else setError('invalid');
      if (mode === 'app') {
        setCode('');
        firstDigitRef.current?.focus();
      } else {
        backupRef.current?.select();
      }
    }
    setLoading(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === 'app') {
      if (code.length < 6) {
        setError('incomplete');
        firstDigitRef.current?.focus();
        return;
      }
      void submit(code);
    } else {
      const v = backup.trim();
      if (!v) {
        setError('backupEmpty');
        backupRef.current?.focus();
        return;
      }
      void submit(v);
    }
  }

  const errorText =
    error === 'invalid'
      ? t('access.twoFactor.invalid')
      : error === 'locked'
        ? t('access.login.locked')
        : error === 'network'
          ? t('access.errors.network')
          : '';

  return (
    <>
      <div className={s.back}>
        <TextButton tone="back" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden="true" />
          {t('access.twoFactor.back')}
        </TextButton>
      </div>
      <AuthHeading key="2fa" title={t('access.twoFactor.title')} subtitle={t('access.twoFactor.subtitle')} />
      {errorText && <Notice kind="error">{errorText}</Notice>}

      <form onSubmit={handleSubmit} noValidate>
        {mode === 'app' ? (
          <div className={s.promoRow}>
            <p id="tf-label" className={s.codeLabel}>
              {t('access.twoFactor.code')}
            </p>
            <CodeInput
              value={code}
              onChange={(v) => {
                setCode(v);
                if (error === 'incomplete') setError('');
              }}
              onComplete={(v) => void submit(v)}
              labelId="tf-label"
              digitLabel={(n) => t('access.twoFactor.digit', { n })}
              invalid={error === 'invalid' || error === 'incomplete'}
              describedBy={error === 'incomplete' ? 'tf-error' : undefined}
              disabled={loading}
              firstInputRef={firstDigitRef}
            />
            {error === 'incomplete' && (
              <p className={s.fieldError} id="tf-error">
                {t('access.twoFactor.incomplete')}
              </p>
            )}
          </div>
        ) : (
          <TextField
            label={t('access.twoFactor.backupLabel')}
            help={t('access.twoFactor.backupHelp')}
            name="backup-code"
            autoComplete="one-time-code"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={8}
            value={backup}
            onChange={(e) => setBackup(e.target.value)}
            error={error === 'backupEmpty' ? t('access.twoFactor.backupEmpty') : undefined}
            inputRef={backupRef}
          />
        )}
        <AppButton type="submit" loading={loading}>
          {t('access.twoFactor.submit')}
        </AppButton>
      </form>

      <p className={s.alt}>
        <TextButton
          onClick={() => {
            setMode(mode === 'app' ? 'backup' : 'app');
            setError('');
            // El campo nuevo se enfoca cuando ya está en pantalla
            requestAnimationFrame(() => (mode === 'app' ? backupRef.current : firstDigitRef.current)?.focus());
          }}
        >
          {mode === 'app' ? t('access.twoFactor.useBackup') : t('access.twoFactor.useApp')}
        </TextButton>
      </p>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginScreen />
    </Suspense>
  );
}
