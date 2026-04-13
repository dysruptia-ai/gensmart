-- Up Migration
-- Track all media (image/video/document/audio) sent by agents to users
-- Used for: debugging, future billing, rate limiting analytics, compliance
CREATE TABLE media_send_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  channel VARCHAR(50) NOT NULL,             -- 'whatsapp' | 'web'
  media_type VARCHAR(20) NOT NULL,          -- 'image' | 'video' | 'document' | 'audio'
  media_url TEXT NOT NULL,
  caption TEXT,
  status VARCHAR(20) NOT NULL,              -- 'sent' | 'failed' | 'rejected_validation' | 'rejected_rate_limit'
  error_message TEXT,
  size_bytes INTEGER,
  mime_type VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_media_logs_conversation ON media_send_logs(conversation_id, created_at DESC);
CREATE INDEX idx_media_logs_agent ON media_send_logs(agent_id, created_at DESC);
CREATE INDEX idx_media_logs_org_period ON media_send_logs(organization_id, created_at DESC);
CREATE INDEX idx_media_logs_status ON media_send_logs(status) WHERE status != 'sent';

-- Down Migration
DROP TABLE IF EXISTS media_send_logs;
