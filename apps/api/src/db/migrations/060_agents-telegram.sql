-- Up Migration
-- Telegram channel: the user pastes a Bot Token from @BotFather (no OAuth). One bot can feed only one agent
-- (a bot has a single webhook URL) and the webhook resolves the agent by the secret_token Telegram echoes back
-- in X-Telegram-Bot-Api-Secret-Token, so both values are unique when set. Agents without a bot (NULL or
-- empty string) do not collide.
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS telegram_config JSONB DEFAULT '{"bot_id":null,"bot_username":null,"bot_token_encrypted":null,"webhook_secret_token":null,"connected":false}';

CREATE UNIQUE INDEX uq_agents_telegram_bot_id
  ON agents ((telegram_config->>'bot_id'))
  WHERE COALESCE(telegram_config->>'bot_id', '') <> '';

CREATE UNIQUE INDEX uq_agents_telegram_webhook_secret
  ON agents ((telegram_config->>'webhook_secret_token'))
  WHERE COALESCE(telegram_config->>'webhook_secret_token', '') <> '';

-- Telegram identifies a private conversation by chat_id (a signed 64-bit integer); contacts have no other column for it.
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR(32);

CREATE UNIQUE INDEX uq_contacts_org_telegram_chat_id
  ON contacts (organization_id, telegram_chat_id)
  WHERE telegram_chat_id IS NOT NULL;

-- Down Migration
DROP INDEX IF EXISTS uq_contacts_org_telegram_chat_id;
ALTER TABLE contacts DROP COLUMN IF EXISTS telegram_chat_id;
DROP INDEX IF EXISTS uq_agents_telegram_webhook_secret;
DROP INDEX IF EXISTS uq_agents_telegram_bot_id;
ALTER TABLE agents DROP COLUMN IF EXISTS telegram_config;
