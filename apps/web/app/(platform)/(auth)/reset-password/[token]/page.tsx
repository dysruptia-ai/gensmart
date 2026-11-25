'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';
import { AppButton, AppButtonLink, Notice, PasswordField, PasswordRules, passwordIsValid } from '@/components/app';
import { AuthHeading, useAuthScreen } from '@/components/auth';
import { isNetworkError, isRateLimited } from '@/components/auth/authForm';
import s from '@/components/auth/auth-screens.module.css';

export default function ResetPasswordPage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const token = String(params.token ?? '');
  const { t } = useTranslation();

  const [password, setPassword] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [error, setError] = useState<'' | 'invalid' | 'locked' | 'generic' | 'network'>('');
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  useAuthScreen({ title: t('access.meta.reset'), panel: null });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordIsValid(password)) {
      setFieldError(t('access.register.ePassword'));
      passwordRef.current?.focus();
      return;
    }
    setFieldError('');
    setError('');
    setLoading(true);
    try {
      await api.post('/api/auth/reset-password', { token, password });
      router.replace('/login?reset=1');
      return;
    } catch (err) {
      if (err instanceof ApiError && err.code === 'INVALID_RESET_TOKEN') setError('invalid');
      else if (isRateLimited(err)) setError('locked');
      else setError(isNetworkError(err) ? 'network' : 'generic');
    }
    setLoading(false);
  }

  return (
    <>
      <div className={s.back}>
        <Link href="/login" className={s.backLink}>
          <ArrowLeft size={16} aria-hidden="true" />
          {t('access.reset.back')}
        </Link>
      </div>
      <AuthHeading title={t('access.reset.title')} subtitle={t('access.reset.subtitle')} />

      {error === 'invalid' ? (
        <>
          <Notice kind="error">{t('access.reset.invalidToken')}</Notice>
          <AppButtonLink href="/forgot-password" variant="secondary">
            {t('access.reset.requestNew')}
          </AppButtonLink>
        </>
      ) : (
        <>
          {error === 'locked' && <Notice kind="error">{t('access.login.locked')}</Notice>}
          {error === 'generic' && <Notice kind="error">{t('access.errors.generic')}</Notice>}
          {error === 'network' && <Notice kind="error">{t('access.errors.network')}</Notice>}
          <form onSubmit={handleSubmit} noValidate>
            {/* Para que el gestor de contraseñas asocie la clave nueva a una cuenta */}
            <input type="text" name="username" autoComplete="username" hidden readOnly />
            <PasswordField
              label={t('access.reset.password')}
              name="new-password"
              autoComplete="new-password"
              placeholder={t('access.register.passwordPh')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={fieldError}
              inputRef={passwordRef}
              describedBy="pw-rules"
              showLabel={t('access.field.show')}
              hideLabel={t('access.field.hide')}
              showAria={t('access.field.showPassword')}
              hideAria={t('access.field.hidePassword')}
              required
            />
            <PasswordRules
              id="pw-rules"
              password={password}
              label={t('access.register.rulesLabel')}
              rules={{
                length: t('access.register.rule8'),
                upper: t('access.register.ruleUpper'),
                number: t('access.register.ruleNumber'),
              }}
              metLabel={t('access.register.ruleMet')}
              unmetLabel={t('access.register.ruleUnmet')}
            />
            <AppButton type="submit" loading={loading}>
              {t('access.reset.submit')}
            </AppButton>
          </form>
        </>
      )}
    </>
  );
}
