-- Up Migration
-- Facebook Messenger channel: one Facebook Page can feed only one agent (the webhook resolves the
-- agent by page_id), same rule as uq_agents_whatsapp_phone_number_id. Agents without a page
-- (NULL or empty string) do not collide.
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS facebook_config JSONB DEFAULT '{"page_id":null,"page_access_token_encrypted":null,"connected":false}';

CREATE UNIQUE INDEX uq_agents_facebook_page_id
  ON agents ((facebook_config->>'page_id'))
  WHERE COALESCE(facebook_config->>'page_id', '') <> '';

-- Messenger identifies the sender by a page-scoped ID (PSID); contacts have no other column for it.
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS facebook_psid VARCHAR(64);

CREATE UNIQUE INDEX uq_contacts_org_facebook_psid
  ON contacts (organization_id, facebook_psid)
  WHERE facebook_psid IS NOT NULL;

INSERT INTO platform_settings (key, value, is_encrypted, description) VALUES
  ('meta_config_id_messenger', '', false, 'Facebook Login configuration ID for Messenger Embedded Signup');

-- Down Migration
DELETE FROM platform_settings WHERE key = 'meta_config_id_messenger';
DROP INDEX IF EXISTS uq_contacts_org_facebook_psid;
ALTER TABLE contacts DROP COLUMN IF EXISTS facebook_psid;
DROP INDEX IF EXISTS uq_agents_facebook_page_id;
ALTER TABLE agents DROP COLUMN IF EXISTS facebook_config;
