-- Up Migration
CREATE TABLE promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(100) UNIQUE NOT NULL,
  plan VARCHAR(50) NOT NULL DEFAULT 'pro',
  duration_days INTEGER NOT NULL DEFAULT 30,
  max_uses INTEGER,
  used_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_promo_codes_code ON promo_codes(code);

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS promo_code_id UUID REFERENCES promo_codes(id);

-- Seed the global launch code
INSERT INTO promo_codes (code, plan, duration_days, max_uses, is_active)
VALUES ('GENSMART-LAUNCH', 'pro', 30, NULL, true);

-- Template for creating unique agency codes:
-- INSERT INTO promo_codes (code, plan, duration_days, max_uses, is_active)
-- VALUES ('PRO-AGENCYNAME-2026', 'pro', 30, 1, true);

-- Down Migration
ALTER TABLE organizations
  DROP COLUMN IF EXISTS promo_code_id,
  DROP COLUMN IF EXISTS trial_ends_at;

DROP TABLE IF EXISTS promo_codes;
