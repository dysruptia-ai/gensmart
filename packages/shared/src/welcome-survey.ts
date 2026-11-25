import { z } from 'zod';

/**
 * Cuestionario de bienvenida (web-37): única fuente de los valores permitidos, para la API
 * (`PATCH /api/organization/onboarding`) y la web (`/welcome`). Se guarda en `organizations.onboarding_*`
 * (migración 076). No confundir con el tour guiado (`users.onboarding_completed`).
 */

/**
 * Ids de las 12 industrias del sitio. DEBEN COINCIDIR con los `id` de
 * `apps/web/components/site/industries/industriesData.ts` (la web de la plataforma no importa del sitio).
 */
export const WELCOME_INDUSTRIES = [
  'industryEcommerce',
  'industryClinics',
  'industryRealEstate',
  'industryFieldServices',
  'industryEducation',
  'industryRestaurants',
  'industryAutomotive',
  'industryBeautyWellness',
  'industryFinanceInsurance',
  'industryTravel',
  'industryProfessionalServices',
  'industryB2b',
] as const;

export const WELCOME_INDUSTRY_OTHER = 'other';
export const WELCOME_INDUSTRY_VALUES = [...WELCOME_INDUSTRIES, WELCOME_INDUSTRY_OTHER] as const;
export const WELCOME_TEAM_SIZES = ['1', '2-5', '6-20', '20+'] as const;
export const WELCOME_MONTHLY_VOLUMES = ['<100', '100-500', '500-2000', '2000+', 'unknown'] as const;
export const WELCOME_GOALS = ['sales', 'support', 'booking', 'store', 'collections', 'hr'] as const;
export const WELCOME_MAX_GOALS = 2;
/** `unknown` ("aún no lo sé") excluye a los demás canales. */
export const WELCOME_CHANNELS = ['whatsapp', 'instagram', 'messenger', 'telegram', 'email', 'web', 'unknown'] as const;
export const WELCOME_SOURCES = ['google', 'social', 'referral', 'partner', 'event', 'ai_tool', 'other'] as const;
export const WELCOME_TEXT_MAX = 120;

export type WelcomeIndustry = (typeof WELCOME_INDUSTRY_VALUES)[number];
export type WelcomeTeamSize = (typeof WELCOME_TEAM_SIZES)[number];
export type WelcomeMonthlyVolume = (typeof WELCOME_MONTHLY_VOLUMES)[number];
export type WelcomeGoal = (typeof WELCOME_GOALS)[number];
export type WelcomeChannel = (typeof WELCOME_CHANNELS)[number];
export type WelcomeSource = (typeof WELCOME_SOURCES)[number];

/** `pending`: le toca. `completed`/`skipped`: ya pasó. `none`: no le corresponde (invitado, subcuenta, Tiendanube, anterior a la migración). */
export type WelcomeSurveyStatus = 'pending' | 'completed' | 'skipped' | 'none';

export interface WelcomeAnswers {
  industry: WelcomeIndustry | null;
  industryOther: string | null;
  teamSize: WelcomeTeamSize | null;
  monthlyVolume: WelcomeMonthlyVolume | null;
  goals: WelcomeGoal[];
  channels: WelcomeChannel[];
  source: WelcomeSource | null;
  partner: string | null;
}

export interface WelcomeSurveyState {
  status: WelcomeSurveyStatus;
  answers: WelcomeAnswers;
  /** El `?ref=` del enlace de registro (para marcar "socio" en el paso 5). */
  refCode: string | null;
}

/** Texto libre: se recorta; vacío = sin responder (null). */
const freeText = z
  .string()
  .trim()
  .max(WELCOME_TEXT_MAX)
  .transform((v) => (v === '' ? null : v))
  .nullable();

/**
 * Guardado parcial: solo se escriben los campos presentes. `null` (o `[]`) borra la respuesta.
 * `complete` marca el cuestionario como terminado; `skip`, como omitido (si no estaba terminado).
 */
export const welcomeSurveyPatchSchema = z
  .object({
    industry: z.enum(WELCOME_INDUSTRY_VALUES).nullable(),
    industryOther: freeText,
    teamSize: z.enum(WELCOME_TEAM_SIZES).nullable(),
    monthlyVolume: z.enum(WELCOME_MONTHLY_VOLUMES).nullable(),
    goals: z
      .array(z.enum(WELCOME_GOALS))
      .max(WELCOME_MAX_GOALS)
      .refine((a) => new Set(a).size === a.length, 'Duplicated goal'),
    channels: z
      .array(z.enum(WELCOME_CHANNELS))
      .max(WELCOME_CHANNELS.length)
      .refine((a) => new Set(a).size === a.length, 'Duplicated channel')
      .refine((a) => !a.includes('unknown') || a.length === 1, '"unknown" cannot be combined with other channels'),
    source: z.enum(WELCOME_SOURCES).nullable(),
    partner: freeText,
    complete: z.literal(true),
    skip: z.literal(true),
  })
  .partial()
  .strict()
  .refine((v) => !(v.complete && v.skip), 'complete and skip are exclusive');

export type WelcomeSurveyPatch = z.infer<typeof welcomeSurveyPatchSchema>;

/** `?ref=` del registro: solo para atribución, no se valida contra ningún socio. */
export const signupRefSchema = z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/);

/** Nombres (`agent_templates.name`) de las plantillas que puede sugerir la pantalla final. */
export type WelcomeTemplateName =
  | 'Clinic Receptionist'
  | 'Real Estate Agent'
  | 'Restaurant Assistant'
  | 'WooCommerce Store Assistant'
  | 'Appointment Scheduler'
  | 'Lead Capture Agent'
  | 'Customer Service Agent';

const INDUSTRY_TEMPLATES: Partial<Record<WelcomeIndustry, WelcomeTemplateName>> = {
  industryClinics: 'Clinic Receptionist',
  industryRealEstate: 'Real Estate Agent',
  industryRestaurants: 'Restaurant Assistant',
};

/**
 * Plantilla sugerida al terminar (regla del diseño, design/05-acceso/LEEME.md): clínicas, inmobiliarias
 * y restaurantes usan la suya; si no, tienda → WooCommerce, citas → Appointment Scheduler,
 * ventas → Lead Capture y lo demás → Customer Service.
 */
export function suggestWelcomeTemplate(answers: Pick<WelcomeAnswers, 'industry' | 'goals'>): WelcomeTemplateName {
  const byIndustry = answers.industry ? INDUSTRY_TEMPLATES[answers.industry] : undefined;
  if (byIndustry) return byIndustry;
  if (answers.goals.includes('store')) return 'WooCommerce Store Assistant';
  if (answers.goals.includes('booking')) return 'Appointment Scheduler';
  if (answers.goals.includes('sales')) return 'Lead Capture Agent';
  return 'Customer Service Agent';
}
