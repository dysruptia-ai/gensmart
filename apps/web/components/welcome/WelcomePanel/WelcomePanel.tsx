'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Check } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { AuthPanelFrame } from '@/components/auth/AuthPanel/AuthPanel';
import { useWelcome } from '../WelcomeContext';
import { DEFAULT_PANEL_INDUSTRY, channelLabel, industryLabel, isSiteIndustry } from '../welcome-data';
import styles from './WelcomePanel.module.css';

/**
 * Panel oscuro del cuestionario: la conversación de ejemplo cambia con la industria elegida y,
 * en los pasos, una lista (industria, primer objetivo, canales) se completa con las respuestas.
 * Siempre rotulado como ejemplo ilustrativo; nunca presenta datos como si fueran del usuario.
 */
export default function WelcomePanel() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const { answers } = useWelcome();
  const isDone = pathname === '/welcome/done';
  const chosen = isSiteIndustry(answers.industry) ? answers.industry : null;
  const shown = chosen ?? DEFAULT_PANEL_INDUSTRY;
  const base = `welcome.industries.${shown}`;

  const heading = isDone ? t('welcome.panel.done') : chosen ? t('welcome.panel.industry') : t('welcome.panel.pick');
  const goals = answers.goals.map((g) => t(`welcome.s3.goals.${g}.label`)).join(', ');
  const channels = answers.channels
    .filter((c) => c !== 'unknown')
    .map((c) => channelLabel(c, t))
    .join(', ');
  const rows = [
    { key: 'clIndustry', value: industryLabel(answers, t) },
    { key: 'clGoal', value: goals },
    { key: 'clChannels', value: channels },
  ];

  return (
    <AuthPanelFrame
      eyebrow={t('welcome.panel.eyebrow')}
      heading={{ before: heading }}
      caption={t('welcome.panel.caption', { industry: t(`${base}.name`) })}
      live={t('welcome.panel.live')}
      messages={(['in', 'out', 'in', 'out'] as const).map((dir, i) => ({ dir, text: t(`${base}.m${i + 1}`) }))}
      conversationKey={shown}
    >
      {!isDone && (
        <ul className={styles.list}>
          {rows.map((r) => (
            <li key={r.key} className={r.value ? styles.set : undefined}>
              <i className={styles.mark}>{r.value && <Check size={12} strokeWidth={3} />}</i>
              <span className={styles.label}>{t(`welcome.panel.${r.key}`)}</span>
              <b className={styles.value}>{r.value || t('welcome.panel.pending')}</b>
            </li>
          ))}
        </ul>
      )}
    </AuthPanelFrame>
  );
}
