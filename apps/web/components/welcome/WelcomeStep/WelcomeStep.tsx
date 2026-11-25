'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  WELCOME_CHANNELS,
  WELCOME_GOALS,
  WELCOME_MAX_GOALS,
  WELCOME_MONTHLY_VOLUMES,
  WELCOME_SOURCES,
  WELCOME_TEAM_SIZES,
  WELCOME_TEXT_MAX,
  type WelcomeAnswers,
  type WelcomeChannel,
  type WelcomeGoal,
  type WelcomeIndustry,
  type WelcomeSurveyPatch,
} from '@gensmart/shared';
import { TextField } from '@/components/app';
import { useAuthScreen } from '@/components/auth';
import { useTranslation } from '@/hooks/useTranslation';
import ChoiceGroup from '../ChoiceGroup/ChoiceGroup';
import { useWelcome } from '../WelcomeContext';
import { INDUSTRY_ORDER, TEAM_LABEL, VOLUME_LABEL, channelLabel, stepAnswered, type WelcomeStepNumber } from '../welcome-data';
import WelcomeStepFrame from './WelcomeStepFrame';
import styles from './WelcomeStep.module.css';

/** Campos que guarda cada paso (al avanzar) y que "Omitir" deja sin responder. */
function stepFields(step: WelcomeStepNumber, a: WelcomeAnswers): WelcomeSurveyPatch {
  switch (step) {
    case 1:
      return { industry: a.industry, industryOther: a.industry === 'other' ? a.industryOther : null };
    case 2:
      return { teamSize: a.teamSize, monthlyVolume: a.monthlyVolume };
    case 3:
      return { goals: a.goals };
    case 4:
      return { channels: a.channels };
    case 5:
      return { source: a.source, partner: a.source === 'partner' ? a.partner : null };
  }
}

const CLEARED: Record<WelcomeStepNumber, Partial<WelcomeAnswers>> = {
  1: { industry: null, industryOther: null },
  2: { teamSize: null, monthlyVolume: null },
  3: { goals: [] },
  4: { channels: [] },
  5: { source: null, partner: null },
};

/** Un paso del cuestionario (1 a 5). Cada paso se guarda al avanzar y se puede omitir. */
export default function WelcomeStep({ step }: { step: WelcomeStepNumber }) {
  const router = useRouter();
  const { t } = useTranslation();
  const { answers, setAnswers, save, stepHref, from, refCode } = useWelcome();
  const [busy, setBusy] = useState<'continue' | 'skip' | 'skipAll' | null>(null);
  const [error, setError] = useState(false);

  useAuthScreen({ title: t(`welcome.s${step}.title`), panel: 'welcome' });

  // Paso 5: si el registro trajo `?ref=` y aún no respondió, llega "socio" marcado con el código
  const [prefilled] = useState(() => step === 5 && answers.source === null && !!refCode);
  const a: WelcomeAnswers = prefilled && answers.source === null && answers.partner === null
    ? { ...answers, source: 'partner', partner: refCode }
    : answers;

  const next = step === 5 ? stepHref('done') : stepHref(step + 1);

  async function persist(kind: 'continue' | 'skip', patch: WelcomeSurveyPatch) {
    setBusy(kind);
    setError(false);
    try {
      await save(step === 5 ? { ...patch, complete: true } : patch);
      router.push(next);
    } catch {
      setError(true);
      setBusy(null);
    }
  }

  async function skipAll() {
    setBusy('skipAll');
    setError(false);
    try {
      await save({ skip: true });
      router.replace(from);
    } catch {
      setError(true);
      setBusy(null);
    }
  }

  function handleSkip() {
    setAnswers(CLEARED[step]);
    void persist('skip', stepFields(step, { ...a, ...CLEARED[step] }));
  }

  return (
    <WelcomeStepFrame
      step={step}
      title={t(`welcome.s${step}.title`)}
      subtitle={t(`welcome.s${step}.subtitle`)}
      canContinue={stepAnswered(step, a)}
      busy={busy}
      error={error}
      onBack={step > 1 ? () => router.push(stepHref(step - 1)) : undefined}
      onContinue={() => void persist('continue', stepFields(step, a))}
      onSkip={handleSkip}
      onSkipAll={() => void skipAll()}
    >
      {step === 1 && <IndustryFields a={a} setAnswers={setAnswers} />}
      {step === 2 && <SizeFields a={a} setAnswers={setAnswers} />}
      {step === 3 && <GoalFields a={a} setAnswers={setAnswers} />}
      {step === 4 && <ChannelFields a={a} setAnswers={setAnswers} />}
      {step === 5 && <SourceFields a={a} setAnswers={setAnswers} fromLink={prefilled && a.partner === refCode} />}
    </WelcomeStepFrame>
  );
}

interface FieldsProps {
  a: WelcomeAnswers;
  setAnswers: (patch: Partial<WelcomeAnswers>) => void;
}

function IndustryFields({ a, setAnswers }: FieldsProps) {
  const { t } = useTranslation();
  const options = [
    ...INDUSTRY_ORDER.map((id) => ({ value: id as WelcomeIndustry, label: t(`welcome.industries.${id}.name`) })),
    { value: 'other' as WelcomeIndustry, label: t('welcome.s1.other') },
  ];
  return (
    <>
      <ChoiceGroup legend={t('welcome.s1.title')} legendHidden layout="grid" options={options} value={a.industry} onChange={(v) => setAnswers({ industry: v })} />
      {a.industry === 'other' && (
        <TextField
          className={styles.otherField}
          label={t('welcome.s1.otherPh')}
          value={a.industryOther ?? ''}
          maxLength={WELCOME_TEXT_MAX}
          onChange={(e) => setAnswers({ industryOther: e.target.value })}
        />
      )}
    </>
  );
}

function SizeFields({ a, setAnswers }: FieldsProps) {
  const { t } = useTranslation();
  return (
    <>
      <ChoiceGroup
        legend={t('welcome.s2.qTeam')}
        layout="pills"
        options={WELCOME_TEAM_SIZES.map((v) => ({ value: v, label: t(`welcome.s2.team.${TEAM_LABEL[v]}`) }))}
        value={a.teamSize}
        onChange={(v) => setAnswers({ teamSize: v })}
      />
      <ChoiceGroup
        legend={t('welcome.s2.qVolume')}
        layout="pills"
        options={WELCOME_MONTHLY_VOLUMES.map((v) => ({ value: v, label: t(`welcome.s2.volume.${VOLUME_LABEL[v]}`) }))}
        value={a.monthlyVolume}
        onChange={(v) => setAnswers({ monthlyVolume: v })}
      />
    </>
  );
}

function GoalFields({ a, setAnswers }: FieldsProps) {
  const { t } = useTranslation();
  const full = a.goals.length >= WELCOME_MAX_GOALS;
  return (
    <ChoiceGroup<WelcomeGoal>
      multiple
      legend={t('welcome.s3.title')}
      legendHidden
      options={WELCOME_GOALS.map((g) => ({
        value: g,
        label: t(`welcome.s3.goals.${g}.label`),
        description: t(`welcome.s3.goals.${g}.desc`),
        disabled: full && !a.goals.includes(g),
      }))}
      value={a.goals}
      hint={full ? t('welcome.s3.limit') : undefined}
      onChange={(g, on) => setAnswers({ goals: on ? [...a.goals, g].slice(0, WELCOME_MAX_GOALS) : a.goals.filter((x) => x !== g) })}
    />
  );
}

function ChannelFields({ a, setAnswers }: FieldsProps) {
  const { t } = useTranslation();
  const unknown = a.channels.includes('unknown');
  return (
    <ChoiceGroup<WelcomeChannel>
      multiple
      legend={t('welcome.s4.title')}
      legendHidden
      layout="grid"
      options={WELCOME_CHANNELS.map((c) => ({
        value: c,
        label: channelLabel(c, t),
        disabled: unknown && c !== 'unknown',
      }))}
      value={a.channels}
      hint={unknown ? t('welcome.s4.unknownHint') : undefined}
      onChange={(c, on) => {
        // "Aún no lo sé" no se combina con los demás canales
        if (c === 'unknown') setAnswers({ channels: on ? ['unknown'] : [] });
        else setAnswers({ channels: on ? [...a.channels.filter((x) => x !== 'unknown'), c] : a.channels.filter((x) => x !== c) });
      }}
    />
  );
}

function SourceFields({ a, setAnswers, fromLink }: FieldsProps & { fromLink: boolean }) {
  const { t } = useTranslation();
  return (
    <>
      <ChoiceGroup
        legend={t('welcome.s5.title')}
        legendHidden
        options={WELCOME_SOURCES.map((s) => ({ value: s, label: t(`welcome.s5.sources.${s}`) }))}
        value={a.source}
        onChange={(v) => setAnswers({ source: v, partner: a.partner })}
      />
      {a.source === 'partner' && (
        <TextField
          className={styles.otherField}
          label={t('welcome.s5.partnerLabel')}
          placeholder={t('welcome.s5.partnerPh')}
          help={fromLink ? `${t('welcome.s5.partnerFound')} ${a.partner ?? ''}` : undefined}
          value={a.partner ?? ''}
          maxLength={WELCOME_TEXT_MAX}
          onChange={(e) => setAnswers({ source: 'partner', partner: e.target.value })}
        />
      )}
    </>
  );
}
