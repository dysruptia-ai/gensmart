-- Up Migration
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS byo_openai_key_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS byo_anthropic_key_encrypted TEXT;

-- Down Migration
ALTER TABLE organizations
  DROP COLUMN IF EXISTS byo_openai_key_encrypted,
  DROP COLUMN IF EXISTS byo_anthropic_key_encrypted;
