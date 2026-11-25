'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { CircleX } from 'lucide-react';
import { api } from '@/lib/api';
import { SUPPORT_EMAIL } from '@/lib/app-links';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/hooks/useTranslation';
import { AppButton, AppButtonLink, Notice } from '@/components/app';
import { AuthHeading, AuthIcon, useAuthScreen } from '@/components/auth';
import s from '@/components/auth/auth-screens.module.css';

export default function OrgAccessPage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const token = String(params.token ?? '');
  const { t } = useTranslation();
  const { refreshUser } = useAuth();

  const [status, setStatus] = useState<'loading' | 'invalid'>('loading');
  const [resend, setResend] = useState<'idle' | 'sending' | 'sent'>('idle');
  const attempted = useRef(false);

  useAuthScreen({ title: t('access.meta.orgAccess'), panel: null });

  async function handleResend() {
    setResend('sending');
    try {
      // La respuesta es siempre la misma (token desconocido, límite, usuario fuera de la
      // organización): esta pantalla nunca confirma si una organización o token existe
      await api.post(`/api/auth/org-access/${encodeURIComponent(token)}/resend`);
    } catch {
      // Incluso un error de red muestra el mismo estado "enviado"
    } finally {
      setResend('sent');
    }
  }

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;
    (async () => {
      try {
        // Pone la cookie httpOnly de refresco; refreshUser() reutiliza el arranque de sesión normal
        await api.post('/api/auth/org-access/consume', { token });
        await refreshUser();
        router.replace('/dashboard');
      } catch {
        setStatus('invalid');
      }
    })();
  }, [token, refreshUser, router]);

  if (status === 'loading') {
    return (
      <>
        <AuthHeading key="loading" title={t('access.orgAccess.loadingTitle')} />
        <p className={s.loadingBox} role="status">
          <span className={s.spinner} aria-hidden="true" />
          {t('access.orgAccess.loading')}
        </p>
      </>
    );
  }

  return (
    <>
      <AuthIcon icon={CircleX} tone="err" />
      <AuthHeading key="bad" title={t('access.orgAccess.invalidTitle')} subtitle={t('access.orgAccess.invalidSubtitle')} />
      {resend === 'sent' ? (
        <Notice kind="success">{t('access.orgAccess.resent')}</Notice>
      ) : (
        <Notice kind="error">{t('access.orgAccess.invalidNotice')}</Notice>
      )}
      <div className={s.stack}>
        {resend !== 'sent' && (
          <AppButton onClick={handleResend} loading={resend === 'sending'}>
            {t('access.orgAccess.resend')}
          </AppButton>
        )}
        <AppButtonLink href={`mailto:${SUPPORT_EMAIL}`} variant="secondary">
          {t('access.orgAccess.support')}
        </AppButtonLink>
      </div>
      <p className={s.alt}>
        <Link href="/login">{t('access.orgAccess.back')}</Link>
      </p>
    </>
  );
}
