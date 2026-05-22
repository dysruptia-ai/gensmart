-- Up Migration

-- ── Day 21: Agent Config Variables ──────────────────────────────────────────
-- Decouples WHAT the agent says (system prompt, developer domain) from WHAT
-- the customer configures (star product, store, policies). The contract lives
-- in agent_templates.config_variables_schema; values live per-agent. Power
-- users can extend the schema via agent.config_variables_schema_overrides.
--
-- See dev-plan.md (Day 21) and spec.md (Configuration Variables).
--
-- Schema entry shape (config_variables_schema, config_variables_schema_overrides):
--   {
--     "key": "producto_estrella_nombre",        // snake_case ^[a-z][a-z0-9_]*$, max 64
--     "type": "string",                         // string|textarea|number|boolean|url|enum
--     "label_en": "Star product name",
--     "label_es": "Nombre del producto estrella",
--     "description_en": "Shown in the greeting",
--     "description_es": "Aparece en el saludo",
--     "required": true,
--     "default": null,                          // optional
--     "placeholder_en": "e.g. Smart Pet Camera",
--     "placeholder_es": "Ej: Cámara inteligente",
--     "group": "Producto",                      // optional, reserved for grouped UI
--     "order": 1,                               // optional, render order asc
--     "options": [                              // enum only
--       { "value": "professional", "label_en": "Professional", "label_es": "Profesional" }
--     ],
--     "min": null,                              // optional, number / string length
--     "max": null,
--     "visible_when": null,                     // RESERVED for conditional fields
--     "help_slug": null                         // RESERVED (post-Day 33 help system)
--   }
--
-- Values shape (config_variables_values):
--   { "producto_estrella_nombre": "Cámara IP", "tono_de_voz": "friendly" }

ALTER TABLE agent_templates
  ADD COLUMN IF NOT EXISTS config_variables_schema JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS vertical TEXT,
  ADD COLUMN IF NOT EXISTS capabilities TEXT[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS integrations TEXT[] NOT NULL DEFAULT '{}'::text[];

-- agent_templates.is_active and agent_templates.language already exist
-- (per 009_create-agent-templates.sql). Use ADD COLUMN IF NOT EXISTS as a no-op
-- safety net.
ALTER TABLE agent_templates
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS language VARCHAR(10) NOT NULL DEFAULT 'en';

ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS config_variables_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS config_variables_schema_overrides JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Link agents back to their source template so the runtime can read the
-- effective schema via JOIN. Nullable: agents created from scratch have no
-- template. ON DELETE SET NULL: deleting a template does not orphan agents,
-- they just lose their template's schema (their overrides + values stay).
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES agent_templates(id) ON DELETE SET NULL;

-- Index for active templates filtered by vertical (future marketplace browse).
CREATE INDEX IF NOT EXISTS idx_agent_templates_vertical
  ON agent_templates(vertical) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_agents_template_id
  ON agents(template_id) WHERE template_id IS NOT NULL;

-- Down Migration
DROP INDEX IF EXISTS idx_agents_template_id;
DROP INDEX IF EXISTS idx_agent_templates_vertical;
ALTER TABLE agents DROP COLUMN IF EXISTS template_id;
ALTER TABLE agents DROP COLUMN IF EXISTS config_variables_schema_overrides;
ALTER TABLE agents DROP COLUMN IF EXISTS config_variables_values;
ALTER TABLE agent_templates DROP COLUMN IF EXISTS integrations;
ALTER TABLE agent_templates DROP COLUMN IF EXISTS capabilities;
ALTER TABLE agent_templates DROP COLUMN IF EXISTS vertical;
ALTER TABLE agent_templates DROP COLUMN IF EXISTS config_variables_schema;
-- Intentionally do NOT drop is_active / language on down: they preexisted this migration.
