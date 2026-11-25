'use client';

import React from 'react';
import { useLanguage, type SupportedLanguage } from '@/contexts/LanguageContext';
import styles from './LanguageSwitch.module.css';

export interface LanguageSwitchProps {
  /** Nombre del grupo ("Idioma" / "Language"). */
  label: string;
}

const OPTIONS: Array<{ value: SupportedLanguage; short: string; name: string }> = [
  { value: 'es', short: 'ES', name: 'Español' },
  { value: 'en', short: 'EN', name: 'English' },
];

/** Selector ES/EN de la plataforma (LanguageContext: guarda la elección y la envía a la cuenta). */
export default function LanguageSwitch({ label }: LanguageSwitchProps) {
  const { language, setLanguage } = useLanguage();
  return (
    <div className={styles.seg} role="group" aria-label={label}>
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          lang={o.value}
          aria-pressed={language === o.value}
          aria-label={o.name}
          onClick={() => setLanguage(o.value)}
        >
          {o.short}
        </button>
      ))}
    </div>
  );
}
