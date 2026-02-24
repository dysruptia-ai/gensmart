-- Up Migration
CREATE TABLE IF NOT EXISTS calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  timezone VARCHAR(100) DEFAULT 'UTC',
  available_days INTEGER[] DEFAULT '{1,2,3,4,5}',
  available_hours JSONB DEFAULT '{"start":"09:00","end":"17:00"}',
  slot_duration INTEGER DEFAULT 30,
  buffer_minutes INTEGER DEFAULT 15,
  max_advance_days INTEGER DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendars_org ON calendars(organization_id);
CREATE INDEX IF NOT EXISTS idx_calendars_agent ON calendars(agent_id);

-- Down Migration
DROP TABLE IF EXISTS calendars CASCADE;
