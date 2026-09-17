-- Up Migration
-- Passwordless "magic link" login tokens for orgs provisioned without a
-- registration form (e.g. Tiendanube auto-provisioning, Dia 3). Unlike
-- password_resets, consuming this token does NOT set a password — it goes
-- straight to buildAuthTokens() for the specific organization_id it targets,
-- which may not be the user's current primary organization_id (multi-org
-- via user_organizations, migration 048).
CREATE TABLE IF NOT EXISTS org_access_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_access_tokens_token ON org_access_tokens(token_hash);

-- Down Migration
DROP TABLE IF EXISTS org_access_tokens CASCADE;
