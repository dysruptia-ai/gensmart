-- Up Migration
CREATE TABLE IF NOT EXISTS sub_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  child_organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  label VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(parent_organization_id, child_organization_id)
);

CREATE INDEX IF NOT EXISTS idx_sub_accounts_parent ON sub_accounts(parent_organization_id);
CREATE INDEX IF NOT EXISTS idx_sub_accounts_child ON sub_accounts(child_organization_id);

-- Down Migration
DROP TABLE IF EXISTS sub_accounts CASCADE;
