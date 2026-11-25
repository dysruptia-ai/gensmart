'use client';

import React from 'react';
import { AppButton, Notice } from '@/components/app';
import { useTranslation } from '@/hooks/useTranslation';
import s from '@/components/auth/auth-screens.module.css';
import { useWelcome } from './WelcomeContext';

/** Mientras carga el estado del cuestionario o si falla: nada del paso se muestra antes de tiempo. */
export default function WelcomeScreen({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { phase, reload } = useWelcome();
  if (phase === 'ready') return <>{children}</>;
  if (phase === 'error') {
    return (
      <>
        <Notice kind="error">{t('welcome.loadError')}</Notice>
        <AppButton variant="secondary" onClick={reload}>
          {t('welcome.retry')}
        </AppButton>
      </>
    );
  }
  return (
    <div className={s.loadingBox} role="status">
      <span className={s.spinner} aria-hidden="true" />
      {t('welcome.loading')}
    </div>
  );
}
