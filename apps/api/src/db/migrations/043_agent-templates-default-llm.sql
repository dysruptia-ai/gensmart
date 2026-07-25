-- Up Migration
ALTER TABLE agent_templates
  ADD COLUMN IF NOT EXISTS default_llm_provider VARCHAR(50) NOT NULL DEFAULT 'openai',
  ADD COLUMN IF NOT EXISTS default_llm_model VARCHAR(100) NOT NULL DEFAULT 'gpt-4o-mini';

-- Down Migration
ALTER TABLE agent_templates
  DROP COLUMN IF EXISTS default_llm_model,
  DROP COLUMN IF EXISTS default_llm_provider;
