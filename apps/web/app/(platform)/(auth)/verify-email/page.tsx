'use client';

import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CircleCheck, CircleX } from 'lucide-react';
import { api } from '@/lib/api';
import { SUPPORT_EMAIL } from '@/lib/app-links';
import { useTranslation } from '@/hooks/useTranslation';
import { AppButton, AppButtonLink, Notice } from '@/components/app';
import { AuthHeading, AuthIcon, useAuthScreen } from '@/components/auth';
import s from '@/components/auth/auth-screens.module.css';

type VerifyStatus = 'loading' | 'success' | 'invalid';

function VerifyEmailScreen() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const { t } = useTranslation();
  const [status, setStatus] = useState<VerifyStatus>(token ? 'loading' : 'invalid');
  // El token es de un solo uso: evita la doble llamada del modo estricto de React
  const attempted = useRef(false);

  useAuthScreen({
    title: status === 'success' ? t('access.verify.successTitle') : t('access.meta.verify'),
    panel: null,
  });

  const verify = useCallback(() => {
    if (!token) return;
    api.post('/api/auth/verify-email', { token }).then(
      () => setStatus('success'),
      () => setStatus('invalid'),
    );
  }, [token]);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;
    verify();
  }, [verify]);

  function retry() {
    setStatus('loading');
    verify();
  }

  if (status === 'loading') {
    return (
      <>
        <AuthHeading key="loading" title={t('access.verify.loadingTitle')} />
        <p className={s.loadingBox} role="status">
          <span className={s.spinner} aria-hidden="true" />
          {t('access.verify.loading')}
        </p>
      </>
    );
  }

  if (status === 'success') {
    return (
      <>
        <AuthIcon icon={CircleCheck} />
        <AuthHeading key="ok" title={t('access.verify.successTitle')} subtitle={t('access.verify.successSubtitle')} />
        {/* Verificar no abre sesión: se ingresa con la contraseña y se llega al panel */}
        <AppButtonLink href="/login?from=%2Fdashboard">{t('access.verify.goLogin')}</AppButtonLink>
      </>
    );
  }

  return (
    <>
      <AuthIcon icon={CircleX} tone="err" />
      <AuthHeading key="bad" title={t('access.verify.invalidTitle')} subtitle={t('access.verify.invalidSubtitle')} />
      <Notice kind="error">{t('access.verify.invalidNotice')}</Notice>
      <div className={s.stack}>
        {token && <AppButton onClick={retry}>{t('access.verify.retry')}</AppButton>}
        <AppButtonLink href={`mailto:${SUPPORT_EMAIL}`} variant="secondary">
          {t('access.verify.support')}
        </AppButtonLink>
      </div>
      <p className={s.alt}>
        <Link href="/login">{t('access.verify.back')}</Link>
      </p>
    </>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailScreen />
    </Suspense>
  );
}
