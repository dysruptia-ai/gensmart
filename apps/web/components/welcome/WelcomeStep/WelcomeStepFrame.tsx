'use client';

import React from 'react';
import { AppButton, Notice, TextButton } from '@/components/app';
import { AuthHeading } from '@/components/auth';
import { useTranslation } from '@/hooks/useTranslation';
import WelcomeProgress from '../WelcomeProgress/WelcomeProgress';
import styles from './WelcomeStep.module.css';

export interface WelcomeStepFrameProps {
  step: number;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  canContinue: boolean;
  busy: 'continue' | 'skip' | 'skipAll' | null;
  error: boolean;
  onBack?: () => void;
  onContinue: () => void;
  onSkip: () => void;
  onSkipAll: () => void;
}

/** Marco común de los pasos 1 a 5: progreso, título (recibe el foco), opciones y acciones. */
export default function WelcomeStepFrame({
  step,
  title,
  subtitle,
  children,
  canContinue,
  busy,
  error,
  onBack,
  onContinue,
  onSkip,
  onSkipAll,
}: WelcomeStepFrameProps) {
  const { t } = useTranslation();
  return (
    <>
      <WelcomeProgress step={step} total={5} onBack={busy ? undefined : onBack} />
      <AuthHeading key={`welcome-${step}`} title={title} subtitle={subtitle} />
      {error && <Notice kind="error">{t('welcome.saveError')}</Notice>}
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (canContinue && !busy) onContinue();
        }}
      >
        {children}
        <AppButton type="submit" disabled={!canContinue || (busy !== null && busy !== 'continue')} loading={busy === 'continue'}>
          {step === 5 ? t('welcome.finish') : t('welcome.continue')}
        </AppButton>
      </form>
      <p className={styles.skip}>
        <TextButton onClick={onSkip} disabled={busy !== null} aria-busy={busy === 'skip' || undefined}>
          {t('welcome.skip')}
        </TextButton>
      </p>
      <p className={styles.skipAll}>
        <TextButton tone="back" onClick={onSkipAll} disabled={busy !== null} aria-busy={busy === 'skipAll' || undefined}>
          {t('welcome.skipAll')}
        </TextButton>
      </p>
    </>
  );
}
