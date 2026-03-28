-- Up Migration
CREATE TABLE platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT NOT NULL DEFAULT '',
  is_encrypted BOOLEAN DEFAULT FALSE,
  description TEXT,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO platform_settings (key, value, is_encrypted, description) VALUES
  ('whatsapp_system_user_token', '', true, 'Meta System User permanent access token for WhatsApp Cloud API'),
  ('whatsapp_verify_token', '', false, 'Webhook verification token for Meta'),
  ('whatsapp_app_secret', '', true, 'Meta App Secret for webhook signature verification'),
  ('meta_app_id', '', false, 'Meta App ID for Facebook Login SDK'),
  ('meta_config_id', '', false, 'Facebook Login configuration ID for Embedded Signup'),
  ('whatsapp_webhook_url', 'https://api.gensmart.co/api/whatsapp/webhook', false, 'Webhook URL configured in Meta');

-- Down Migration
DROP TABLE IF EXISTS platform_settings;
