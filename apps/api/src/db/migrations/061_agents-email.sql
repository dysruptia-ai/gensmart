-- Up Migration
-- Email channel: inbound mail arrives at agent-{agent id}@<inbound domain> (wildcard MX handled by Resend), so the
-- address needs no unique column — the agent id inside it is the routing key. contacts.email already exists
-- (013_create-contacts) and is reused to identify the sender; it is not made unique because existing rows may
-- already hold duplicates (variable capture writes it freely), so the webhook serialises find-or-create per
-- (organization, email) with an advisory lock instead.
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS email_config JSONB DEFAULT '{"connected":false,"inbound_address":null,"reply_from_name":"","signature_html":"","auto_reply_enabled":false,"auto_reply_text":""}';

-- Lookup by sender within an org (case-insensitive: addresses are stored lower-cased by the webhook)
CREATE INDEX IF NOT EXISTS idx_contacts_org_lower_email
  ON contacts (organization_id, lower(email))
  WHERE email IS NOT NULL;

-- Down Migration
DROP INDEX IF EXISTS idx_contacts_org_lower_email;
ALTER TABLE agents DROP COLUMN IF EXISTS email_config;
