-- Up Migration
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id),
  channel VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  taken_over_by UUID REFERENCES users(id),
  taken_over_at TIMESTAMPTZ,
  channel_metadata JSONB DEFAULT '{}',
  ai_summary TEXT,
  ai_score INTEGER CHECK (ai_score >= 0 AND ai_score <= 10),
  captured_variables JSONB DEFAULT '{}',
  last_message_at TIMESTAMPTZ,
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_agent ON conversations(agent_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_org ON conversations(organization_id);
CREATE INDEX IF NOT EXISTS idx_conversations_contact ON conversations(contact_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(organization_id, status);

-- Down Migration
DROP TABLE IF EXISTS conversations CASCADE;
