'use client';

import React, { useId, useMemo, useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { agentSteps } from './agentSteps';
import StepsView from './StepsView';
import styles from './AgentStepsBlock.module.css';

/**
 * "Lo que hizo el agente · N pasos" (web-46) bajo una respuesta del agente. Plegado por defecto: en
 * conversaciones reales el agente usa varias herramientas por turno y abierto el hilo sería ilegible.
 */
export default function AgentStepsBlock({ toolsCalled }: { toolsCalled: unknown }) {
  const { t, language } = useTranslation();
  const [open, setOpen] = useState(false);
  const listId = useId();
  const steps = useMemo(() => {
    const locale = language === 'es' ? 'es-CO' : 'en-US';
    const formatDate = (iso: string) => {
      const d = new Date(`${iso}T12:00:00Z`);
      return Number.isNaN(d.getTime())
        ? iso
        : new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(d);
    };
    return agentSteps(toolsCalled, t, { formatDate });
  }, [toolsCalled, t, language]);
  if (steps.length === 0) return null;
  return (
    <StepsView
      title={t('inbox.steps.title', { count: steps.length })}
      steps={steps}
      open={open}
      onToggle={() => setOpen((o) => !o)}
      listId={listId}
      classes={styles}
    />
  );
}
