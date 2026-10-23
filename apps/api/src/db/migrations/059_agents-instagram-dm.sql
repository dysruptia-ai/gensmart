-- Up Migration
-- Instagram DM channel: one Instagram professional account can feed only one agent (the webhook resolves
-- the agent by instagram_id), same rule as uq_agents_facebook_page_id. Agents without an account
-- (NULL or empty string) do not collide. conversations.channel / contacts.source_channel are plain
-- VARCHAR(50) with no CHECK constraint, so 'instagram' needs no constraint change.
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS instagram_config JSONB DEFAULT '{"instagram_id":null,"page_id":null,"page_access_token_encrypted":null,"connected":false}';

CREATE UNIQUE INDEX uq_agents_instagram_account_id
  ON agents ((instagram_config->>'instagram_id'))
  WHERE COALESCE(instagram_config->>'instagram_id', '') <> '';

-- Instagram identifies the sender by an Instagram-scoped ID (IGSID); contacts have no other column for it.
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS instagram_psid VARCHAR(64);

CREATE UNIQUE INDEX uq_contacts_org_instagram_psid
  ON contacts (organization_id, instagram_psid)
  WHERE instagram_psid IS NOT NULL;

-- Down Migration
DROP INDEX IF EXISTS uq_contacts_org_instagram_psid;
ALTER TABLE contacts DROP COLUMN IF EXISTS instagram_psid;
DROP INDEX IF EXISTS uq_agents_instagram_account_id;
ALTER TABLE agents DROP COLUMN IF EXISTS instagram_config;
