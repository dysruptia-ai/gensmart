-- Up Migration
CREATE TABLE IF NOT EXISTS agent_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  system_prompt TEXT NOT NULL,
  llm_provider VARCHAR(50) NOT NULL,
  llm_model VARCHAR(100) NOT NULL,
  temperature DECIMAL(3,2),
  max_tokens INTEGER,
  context_window_messages INTEGER,
  variables JSONB,
  tools JSONB,
  published_by UUID REFERENCES users(id),
  published_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, version)
);

CREATE INDEX IF NOT EXISTS idx_agent_versions_agent ON agent_versions(agent_id);

-- Down Migration
DROP TABLE IF EXISTS agent_versions CASCADE;
