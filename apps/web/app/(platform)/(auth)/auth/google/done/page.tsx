'use client';

import React, { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/hooks/useTranslation';
import { AuthHeading, useAuthScreen } from '@/components/auth';
import { afterLoginHref, safeFrom } from '@/components/auth/authForm';
import s from '@/components/auth/auth-screens.module.css';

/**
 * Retorno de Google con la sesión ya creada (web-38): la API dejó la cookie `refresh_token` y el
 * AuthProvider recupera la sesión con el `/api/auth/refresh` de siempre. Ningún token viaja en la URL.
 */
function GoogleDoneScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = safeFrom(searchParams.get('from'));
  const { user, isLoading } = useAuth();
  const { t } = useTranslation();

  useAuthScreen({ title: t('access.oauth.done'), panel: null });

  useEffect(() => {
    if (isLoading) return;
    router.replace(user ? afterLoginHref(from, user.welcomeSurvey) : '/login?oauth_error=failed');
  }, [isLoading, user, from, router]);

  return (
    <>
      <AuthHeading key="done" title={t('access.oauth.done')} />
      <p className={s.loadingBox} role="status">
        <span className={s.spinner} aria-hidden="true" />
        {t('access.oauth.redirecting')}
      </p>
    </>
  );
}

export default function GoogleDonePage() {
  return (
    <Suspense fallback={null}>
      <GoogleDoneScreen />
    </Suspense>
  );
}
