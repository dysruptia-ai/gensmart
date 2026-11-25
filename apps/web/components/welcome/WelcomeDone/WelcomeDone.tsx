'use client';

import React, { useEffect, useState } from 'react';
import { suggestWelcomeTemplate } from '@gensmart/shared';
import { AppButtonLink, TextButton } from '@/components/app';
import { AuthHeading, useAuthScreen } from '@/components/auth';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';
import { useRouter } from 'next/navigation';
import { useWelcome } from '../WelcomeContext';
import { TEAM_LABEL, VOLUME_LABEL, channelLabel, industryLabel } from '../welcome-data';
import styles from './WelcomeDone.module.css';

interface TemplateSummary {
  id: string;
  name: string;
  language: string | null;
}

/**
 * Pantalla final: resumen de lo contestado ("Sin responder" en lo que quedó en blanco) y la
 * plantilla sugerida (regla en `suggestWelcomeTemplate`, con test), en el idioma activo.
 */
export default function WelcomeDone() {
  const router = useRouter();
  const { t, language } = useTranslation();
  const { user } = useAuth();
  const { answers, from } = useWelcome();
  const [templateId, setTemplateId] = useState<string | null>(null);

  useAuthScreen({ title: t('welcome.meta.done'), panel: answers.industry ? 'welcome' : null });

  const suggested = suggestWelcomeTemplate(answers);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ templates: TemplateSummary[] }>('/api/agents/templates')
      .then(({ templates }) => {
        if (cancelled) return;
        const same = templates.filter((tpl) => tpl.name === suggested);
        // La del idioma activo; si esa plantilla solo existe en otro idioma, esa
        setTemplateId((same.find((tpl) => tpl.language === language) ?? same[0])?.id ?? null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [suggested, language]);

  const none = t('welcome.done.notAnswered');
  const firstName = (user?.name ?? '').trim().split(/\s+/)[0] || t('welcome.done.fallbackName');
  const sourceText = answers.source
    ? t(`welcome.s5.sources.${answers.source}`) + (answers.source === 'partner' && answers.partner ? `: ${answers.partner}` : '')
    : '';
  const rows: Array<{ key: string; value: string }> = [
    { key: 'industry', value: industryLabel(answers, t) },
    { key: 'team', value: answers.teamSize ? t(`welcome.s2.team.${TEAM_LABEL[answers.teamSize]}`) : '' },
    { key: 'volume', value: answers.monthlyVolume ? t(`welcome.s2.volume.${VOLUME_LABEL[answers.monthlyVolume]}`) : '' },
    { key: 'goals', value: answers.goals.map((g) => t(`welcome.s3.goals.${g}.label`)).join(', ') },
    { key: 'channels', value: answers.channels.map((c) => channelLabel(c, t)).join(', ') },
    { key: 'source', value: sourceText },
  ];

  const createHref = templateId
    ? `/dashboard/agents/new?template=${encodeURIComponent(templateId)}`
    : '/dashboard/agents/new';

  return (
    <>
      <AuthHeading key="welcome-done" title={t('welcome.done.title', { name: firstName })} subtitle={t('welcome.done.subtitle')} />
      <dl className={styles.sum} aria-label={t('welcome.done.summary')}>
        {rows.map((r) => (
          <div key={r.key} className={r.value ? undefined : styles.empty}>
            <dt>{t(`welcome.done.${r.key}`)}</dt>
            <dd>{r.value || none}</dd>
          </div>
        ))}
      </dl>
      <div className={styles.rec}>
        <small>{t('welcome.done.recKicker')}</small>
        <b>{suggested}</b>
        <p>{t('welcome.done.recText')}</p>
      </div>
      <AppButtonLink href={createHref}>{t('welcome.done.create')}</AppButtonLink>
      <p className={styles.dash}>
        <TextButton onClick={() => router.push(from)}>{t('welcome.done.goDash')}</TextButton>
      </p>
    </>
  );
}
