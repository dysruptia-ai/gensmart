-- Up Migration
-- Track all email notifications sent by agents via the send_email_notification tool
-- Used for: debugging, audit trail, abuse prevention analytics
CREATE TABLE email_notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  tool_id UUID REFERENCES agent_tools(id) ON DELETE SET NULL,
  recipient_email VARCHAR(255) NOT NULL,
  subject TEXT NOT NULL,
  body_preview TEXT,
  status VARCHAR(20) NOT NULL,
  error_message TEXT,
  smtp_message_id VARCHAR(500),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_notif_conversation ON email_notification_logs(conversation_id, created_at DESC);
CREATE INDEX idx_email_notif_agent ON email_notification_logs(agent_id, created_at DESC);
CREATE INDEX idx_email_notif_org_period ON email_notification_logs(organization_id, created_at DESC);
CREATE INDEX idx_email_notif_status ON email_notification_logs(status) WHERE status != 'sent';

-- Down Migration
DROP TABLE IF EXISTS email_notification_logs;
