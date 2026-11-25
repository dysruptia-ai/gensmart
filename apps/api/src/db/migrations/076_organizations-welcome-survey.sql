-- Up Migration
-- Cuestionario de bienvenida (web-37). Aditiva: todas las columnas son opcionales.
-- Los valores permitidos viven en @gensmart/shared (welcome-survey.ts) y los valida la API.
-- No confundir con el tour guiado (users.onboarding_completed / onboarding_step).
--
-- onboarding_survey_eligible: TRUE solo para las organizaciones creadas por POST /api/auth/register
-- desde esta versión. Las anteriores (y las subcuentas y las de Tiendanube) quedan en FALSE y no ven
-- el cuestionario.

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS onboarding_survey_eligible BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS onboarding_industry TEXT NULL;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS onboarding_industry_other TEXT NULL;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS onboarding_team_size TEXT NULL;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS onboarding_monthly_volume TEXT NULL;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS onboarding_goals TEXT[] NULL;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS onboarding_channels TEXT[] NULL;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS onboarding_source TEXT NULL;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS onboarding_partner TEXT NULL;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ NULL;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS onboarding_skipped_at TIMESTAMPTZ NULL;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS signup_ref_code TEXT NULL;

-- Down Migration
ALTER TABLE organizations DROP COLUMN IF EXISTS signup_ref_code;
ALTER TABLE organizations DROP COLUMN IF EXISTS onboarding_skipped_at;
ALTER TABLE organizations DROP COLUMN IF EXISTS onboarding_completed_at;
ALTER TABLE organizations DROP COLUMN IF EXISTS onboarding_partner;
ALTER TABLE organizations DROP COLUMN IF EXISTS onboarding_source;
ALTER TABLE organizations DROP COLUMN IF EXISTS onboarding_channels;
ALTER TABLE organizations DROP COLUMN IF EXISTS onboarding_goals;
ALTER TABLE organizations DROP COLUMN IF EXISTS onboarding_monthly_volume;
ALTER TABLE organizations DROP COLUMN IF EXISTS onboarding_team_size;
ALTER TABLE organizations DROP COLUMN IF EXISTS onboarding_industry_other;
ALTER TABLE organizations DROP COLUMN IF EXISTS onboarding_industry;
ALTER TABLE organizations DROP COLUMN IF EXISTS onboarding_survey_eligible;
