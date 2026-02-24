-- Up Migration
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  avatar_url TEXT,
  avatar_initials VARCHAR(5),
  system_prompt TEXT NOT NULL,
  llm_provider VARCHAR(50) NOT NULL,
  llm_model VARCHAR(100) NOT NULL,
  temperature DECIMAL(3,2) DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 1024,
  context_window_messages INTEGER DEFAULT 15,
  status VARCHAR(50) DEFAULT 'draft',
  channels JSONB DEFAULT '[]',
  message_buffer_seconds INTEGER DEFAULT 5,
  variables JSONB DEFAULT '[]',
  web_config JSONB DEFAULT '{"primary_color":"#25D366","avatar_url":null,"welcome_message":"Hello! How can I help you?","position":"bottom-right","bubble_text":"Chat with us"}',
  whatsapp_config JSONB DEFAULT '{"phone_number_id":null,"waba_id":null,"access_token_encrypted":null,"verify_token":null,"connected":false}',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agents_org ON agents(organization_id);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(organization_id, status);

-- Down Migration
DROP TABLE IF EXISTS agents CASCADE;
