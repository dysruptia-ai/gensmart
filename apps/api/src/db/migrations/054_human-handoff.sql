-- Up Migration
ALTER TABLE agents ADD COLUMN handoff_config JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE conversations ADD COLUMN handed_off_at TIMESTAMPTZ;

-- Down Migration
ALTER TABLE conversations DROP COLUMN IF EXISTS handed_off_at;
ALTER TABLE agents DROP COLUMN IF EXISTS handoff_config;
