-- Up Migration
-- The webhook secret Telegram echoes back in X-Telegram-Bot-Api-Secret-Token never changes once set
-- (it is the same value GenSmart registered via setTelegramWebhook), so it can be hashed at rest and
-- compared by hash on every webhook call without any client-side reconnection.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

UPDATE agents
SET telegram_config = jsonb_set(
      jsonb_set(
        telegram_config,
        '{webhook_secret_token_hash}',
        to_jsonb(encode(digest(telegram_config->>'webhook_secret_token', 'sha256'), 'hex'))
      ),
      '{webhook_secret_token}',
      'null'::jsonb
    )
WHERE COALESCE(telegram_config->>'webhook_secret_token', '') <> '';

DROP INDEX IF EXISTS uq_agents_telegram_webhook_secret;

CREATE UNIQUE INDEX uq_agents_telegram_webhook_secret_hash
  ON agents ((telegram_config->>'webhook_secret_token_hash'))
  WHERE COALESCE(telegram_config->>'webhook_secret_token_hash', '') <> '';

-- Down Migration
-- Irreversible by design: the plaintext webhook_secret_token was discarded once hashed, so the down
-- migration cannot restore it. It only removes the hash-based index.
DROP INDEX IF EXISTS uq_agents_telegram_webhook_secret_hash;
