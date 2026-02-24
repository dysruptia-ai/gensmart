-- Up Migration
CREATE TABLE IF NOT EXISTS usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id),
  metric VARCHAR(100) NOT NULL,
  value INTEGER NOT NULL,
  period DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_org_period ON usage_logs(organization_id, period);
CREATE INDEX IF NOT EXISTS idx_usage_agent ON usage_logs(agent_id, period);

-- Down Migration
DROP TABLE IF EXISTS usage_logs CASCADE;
