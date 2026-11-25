/**
 * Cuestionario de bienvenida (web-37): respuestas en `organizations.onboarding_*` (migración 076).
 */
import type {
  WelcomeAnswers,
  WelcomeSurveyPatch,
  WelcomeSurveyState,
  WelcomeSurveyStatus,
} from '@gensmart/shared';
import { query } from '../config/database';
import { AppError } from '../middleware/errorHandler';

/** Columnas que necesita el estado del cuestionario (se suman a los SELECT de la sesión). */
export const WELCOME_SURVEY_COLUMNS =
  'onboarding_survey_eligible, onboarding_completed_at, onboarding_skipped_at';

export interface WelcomeSurveyFlagsRow {
  onboarding_survey_eligible: boolean | null;
  onboarding_completed_at: string | Date | null;
  onboarding_skipped_at: string | Date | null;
}

export interface WelcomeSurveyRow extends WelcomeSurveyFlagsRow {
  onboarding_industry: string | null;
  onboarding_industry_other: string | null;
  onboarding_team_size: string | null;
  onboarding_monthly_volume: string | null;
  onboarding_goals: string[] | null;
  onboarding_channels: string[] | null;
  onboarding_source: string | null;
  onboarding_partner: string | null;
  signup_ref_code: string | null;
}

/**
 * Quién ve el cuestionario: solo el dueño de una organización creada por /register desde la
 * migración 076 (`onboarding_survey_eligible`), y solo mientras no lo completó ni lo omitió.
 * Los invitados (admin/member), las subcuentas, las cuentas de Tiendanube (/org-access), las
 * organizaciones anteriores y los superadmin reciben `none`.
 */
export function resolveWelcomeStatus(
  org: WelcomeSurveyFlagsRow | undefined,
  role: string | undefined,
  isSuperAdmin: boolean
): WelcomeSurveyStatus {
  if (!org || !org.onboarding_survey_eligible || role !== 'owner' || isSuperAdmin) return 'none';
  if (org.onboarding_completed_at) return 'completed';
  if (org.onboarding_skipped_at) return 'skipped';
  return 'pending';
}

function toAnswers(row: WelcomeSurveyRow): WelcomeAnswers {
  // Lo guardado ya pasó por el esquema compartido: los casts solo estrechan el tipo
  return {
    industry: row.onboarding_industry as WelcomeAnswers['industry'],
    industryOther: row.onboarding_industry_other,
    teamSize: row.onboarding_team_size as WelcomeAnswers['teamSize'],
    monthlyVolume: row.onboarding_monthly_volume as WelcomeAnswers['monthlyVolume'],
    goals: (row.onboarding_goals ?? []) as WelcomeAnswers['goals'],
    channels: (row.onboarding_channels ?? []) as WelcomeAnswers['channels'],
    source: row.onboarding_source as WelcomeAnswers['source'],
    partner: row.onboarding_partner,
  };
}

const FIELD_COLUMNS: Record<keyof WelcomeAnswers, string> = {
  industry: 'onboarding_industry',
  industryOther: 'onboarding_industry_other',
  teamSize: 'onboarding_team_size',
  monthlyVolume: 'onboarding_monthly_volume',
  goals: 'onboarding_goals',
  channels: 'onboarding_channels',
  source: 'onboarding_source',
  partner: 'onboarding_partner',
};

/**
 * UPDATE parametrizado con solo los campos presentes (guardado parcial). Los nombres de columna salen
 * de la lista fija de arriba, nunca de la entrada. `[]` se guarda como NULL (sin responder).
 */
export function buildWelcomeSurveyUpdate(
  orgId: string,
  patch: WelcomeSurveyPatch
): { sql: string; params: unknown[] } | null {
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const key of Object.keys(FIELD_COLUMNS) as Array<keyof WelcomeAnswers>) {
    if (!(key in patch)) continue;
    const value = patch[key];
    params.push(Array.isArray(value) && value.length === 0 ? null : value ?? null);
    sets.push(`${FIELD_COLUMNS[key]} = $${params.length}`);
  }
  if (patch.complete) sets.push('onboarding_completed_at = COALESCE(onboarding_completed_at, NOW())');
  // Omitir no pisa un cuestionario ya terminado
  if (patch.skip) {
    sets.push(
      'onboarding_skipped_at = CASE WHEN onboarding_completed_at IS NULL THEN COALESCE(onboarding_skipped_at, NOW()) ELSE onboarding_skipped_at END'
    );
  }
  if (sets.length === 0) return null;
  sets.push('updated_at = NOW()');
  params.push(orgId);
  return { sql: `UPDATE organizations SET ${sets.join(', ')} WHERE id = $${params.length}`, params };
}

async function loadRow(orgId: string): Promise<WelcomeSurveyRow> {
  const result = await query<WelcomeSurveyRow>(
    `SELECT ${WELCOME_SURVEY_COLUMNS}, onboarding_industry, onboarding_industry_other, onboarding_team_size,
            onboarding_monthly_volume, onboarding_goals, onboarding_channels, onboarding_source,
            onboarding_partner, signup_ref_code
     FROM organizations WHERE id = $1`,
    [orgId]
  );
  const row = result.rows[0];
  if (!row) throw new AppError(404, 'Organization not found', 'ORG_NOT_FOUND');
  return row;
}

export async function getWelcomeSurvey(orgId: string, role: string, isSuperAdmin: boolean): Promise<WelcomeSurveyState> {
  const row = await loadRow(orgId);
  return {
    status: resolveWelcomeStatus(row, role, isSuperAdmin),
    answers: toAnswers(row),
    refCode: row.signup_ref_code,
  };
}

export async function patchWelcomeSurvey(
  orgId: string,
  role: string,
  isSuperAdmin: boolean,
  patch: WelcomeSurveyPatch
): Promise<WelcomeSurveyState> {
  const current = await loadRow(orgId);
  if (resolveWelcomeStatus(current, role, isSuperAdmin) === 'none') {
    throw new AppError(403, 'The welcome survey does not apply to this organization', 'WELCOME_SURVEY_NOT_APPLICABLE');
  }
  const update = buildWelcomeSurveyUpdate(orgId, patch);
  if (update) await query(update.sql, update.params);
  return getWelcomeSurvey(orgId, role, isSuperAdmin);
}
