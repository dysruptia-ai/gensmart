'use client';

import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { TextButton } from '@/components/app';
import { useTranslation } from '@/hooks/useTranslation';
import styles from './WelcomeProgress.module.css';

export interface WelcomeProgressProps {
  step: number;
  total: number;
  onBack?: () => void;
}

/** "Atrás", "Paso n de 5" y la barra de progreso. */
export default function WelcomeProgress({ step, total, onBack }: WelcomeProgressProps) {
  const { t } = useTranslation();
  const label = t('welcome.stepOf', { n: step });
  return (
    <div className={styles.prog}>
      <div className={styles.row}>
        <span>
          {onBack && (
            <TextButton tone="back" onClick={onBack}>
              <ArrowLeft size={16} aria-hidden="true" />
              {t('welcome.back')}
            </TextButton>
          )}
        </span>
        <span>{label}</span>
      </div>
      <div
        className={styles.bar}
        role="progressbar"
        aria-label={t('welcome.progress')}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={step}
        aria-valuetext={label}
      >
        {Array.from({ length: total }, (_, i) => (
          <i key={i} className={i < step ? styles.on : undefined} />
        ))}
      </div>
    </div>
  );
}
