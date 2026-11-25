import {
  WELCOME_INDUSTRIES,
  type WelcomeAnswers,
  type WelcomeChannel,
  type WelcomeIndustry,
  type WelcomeMonthlyVolume,
  type WelcomeTeamSize,
} from '@gensmart/shared';

/** Pasos del cuestionario (`/welcome/1` a `/welcome/5`; después, `/welcome/done`). */
export const WELCOME_STEPS = [1, 2, 3, 4, 5] as const;
export type WelcomeStepNumber = (typeof WELCOME_STEPS)[number];

export function parseWelcomeStep(raw: string): WelcomeStepNumber | 'done' | null {
  if (raw === 'done') return 'done';
  const n = Number(raw);
  return (WELCOME_STEPS as readonly number[]).includes(n) && String(n) === raw ? (n as WelcomeStepNumber) : null;
}

/** Orden del prototipo (clínicas primero); los ids son los del sitio. */
export const INDUSTRY_ORDER: ReadonlyArray<(typeof WELCOME_INDUSTRIES)[number]> = [
  'industryClinics',
  ...WELCOME_INDUSTRIES.filter((id) => id !== 'industryClinics'),
];

/** Industria del panel cuando aún no hay una elegida (la del prototipo). */
export const DEFAULT_PANEL_INDUSTRY: (typeof WELCOME_INDUSTRIES)[number] = 'industryClinics';

export function isSiteIndustry(v: WelcomeIndustry | null): v is (typeof WELCOME_INDUSTRIES)[number] {
  return v !== null && (WELCOME_INDUSTRIES as readonly string[]).includes(v);
}

/** Valor guardado → clave de texto (`welcome.s2.team.*` / `welcome.s2.volume.*`). */
export const TEAM_LABEL: Record<WelcomeTeamSize, string> = { '1': 't1', '2-5': 't2', '6-20': 't3', '20+': 't4' };
export const VOLUME_LABEL: Record<WelcomeMonthlyVolume, string> = {
  '<100': 'v1',
  '100-500': 'v2',
  '500-2000': 'v3',
  '2000+': 'v4',
  unknown: 'v0',
};

/** Canales con nombre propio (no se traducen); los demás van por clave en `welcome.s4.*`. */
const CHANNEL_BRANDS: Partial<Record<WelcomeChannel, string>> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  messenger: 'Messenger',
  telegram: 'Telegram',
};

export function channelLabel(c: WelcomeChannel, t: (key: string) => string): string {
  return CHANNEL_BRANDS[c] ?? t(`welcome.s4.${c}`);
}

export function industryLabel(answers: Pick<WelcomeAnswers, 'industry' | 'industryOther'>, t: (key: string) => string): string {
  if (!answers.industry) return '';
  if (answers.industry === 'other') return answers.industryOther || t('welcome.s1.other');
  return t(`welcome.industries.${answers.industry}.name`);
}

/** Si un paso tiene alguna respuesta guardada. */
export function stepAnswered(step: WelcomeStepNumber, a: WelcomeAnswers): boolean {
  switch (step) {
    case 1:
      return a.industry !== null;
    case 2:
      return a.teamSize !== null || a.monthlyVolume !== null;
    case 3:
      return a.goals.length > 0;
    case 4:
      return a.channels.length > 0;
    case 5:
      return a.source !== null;
  }
}

/** Al volver, se retoma en el primer paso sin responder (o el último, si todos tienen respuesta). */
export function firstUnansweredStep(a: WelcomeAnswers): WelcomeStepNumber {
  return WELCOME_STEPS.find((s) => !stepAnswered(s, a)) ?? 5;
}

export const EMPTY_ANSWERS: WelcomeAnswers = {
  industry: null,
  industryOther: null,
  teamSize: null,
  monthlyVolume: null,
  goals: [],
  channels: [],
  source: null,
  partner: null,
};
