-- Up Migration
CREATE TABLE IF NOT EXISTS user_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_user_organizations_user ON user_organizations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_organizations_org ON user_organizations(organization_id);

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS billing_source VARCHAR(20) NOT NULL DEFAULT 'stripe',
  ADD COLUMN IF NOT EXISTS external_subscription_id VARCHAR(255);

-- Data migration: backfill la tabla puente desde el estado actual (users.organization_id + users.role)
INSERT INTO user_organizations (user_id, organization_id, role)
SELECT id, organization_id, role
FROM users
WHERE organization_id IS NOT NULL
ON CONFLICT (user_id, organization_id) DO NOTHING;

-- Down Migration
DROP TABLE IF EXISTS user_organizations CASCADE;
ALTER TABLE organizations
  DROP COLUMN IF EXISTS external_subscription_id,
  DROP COLUMN IF EXISTS billing_source;
