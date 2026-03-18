-- Up Migration
ALTER TABLE agent_templates ADD CONSTRAINT agent_templates_name_language_unique UNIQUE (name, language);

-- Down Migration
ALTER TABLE agent_templates DROP CONSTRAINT IF EXISTS agent_templates_name_language_unique;
