-- Up Migration
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id),
  name VARCHAR(255),
  phone VARCHAR(50),
  email VARCHAR(255),
  avatar_url TEXT,
  ai_summary TEXT,
  ai_score INTEGER CHECK (ai_score >= 0 AND ai_score <= 10),
  ai_service VARCHAR(255),
  funnel_stage VARCHAR(50) DEFAULT 'lead',
  funnel_updated_at TIMESTAMPTZ,
  custom_variables JSONB DEFAULT '{}',
  source_channel VARCHAR(50),
  tags JSONB DEFAULT '[]',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_org ON contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_contacts_funnel ON contacts(organization_id, funnel_stage);
CREATE INDEX IF NOT EXISTS idx_contacts_score ON contacts(organization_id, ai_score DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_custom_vars ON contacts USING GIN(custom_variables);

-- Down Migration
DROP TABLE IF EXISTS contacts CASCADE;
