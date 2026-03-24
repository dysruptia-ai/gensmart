-- Up Migration
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 0;

-- Down Migration
ALTER TABLE users
  DROP COLUMN IF EXISTS onboarding_completed,
  DROP COLUMN IF EXISTS onboarding_step;
