-- Up Migration
CREATE TABLE IF NOT EXISTS knowledge_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  file_type VARCHAR(20) NOT NULL,
  source_url TEXT,
  file_path TEXT,
  file_size INTEGER,
  status VARCHAR(50) DEFAULT 'processing',
  error_message TEXT,
  chunk_count INTEGER DEFAULT 0,
  last_processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_files_agent ON knowledge_files(agent_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_files_status ON knowledge_files(status);

-- Down Migration
DROP TABLE IF EXISTS knowledge_files CASCADE;
