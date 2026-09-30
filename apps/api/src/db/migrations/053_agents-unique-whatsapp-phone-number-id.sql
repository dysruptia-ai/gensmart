-- Up Migration
-- Requires that no duplicate phone_number_id values exist beforehand; Genner checks this
-- by hand before deploying (a failing index creation aborts the deploy).
-- Partial index so agents without a number (NULL or empty string) do not collide.
CREATE UNIQUE INDEX uq_agents_whatsapp_phone_number_id
  ON agents ((whatsapp_config->>'phone_number_id'))
  WHERE COALESCE(whatsapp_config->>'phone_number_id', '') <> '';

-- Down Migration
DROP INDEX IF EXISTS uq_agents_whatsapp_phone_number_id;
