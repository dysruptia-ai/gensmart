-- Up Migration
-- Beta gating for agent templates (same contract as mcp_provider_profiles.allowed_org_ids, 070):
--   NULL            → visible to every organization (all existing templates);
--   JSON array      → visible only to the organization ids it contains ('[]' = hidden for everyone).
-- Listing and createFromTemplate (services/agent.service.ts) filter by it; a hidden template
-- answers exactly like a nonexistent one. The seed sets it only on INSERT and never overwrites it,
-- so a beta enabled by SQL survives `npm run seed`.
ALTER TABLE agent_templates ADD COLUMN IF NOT EXISTS allowed_org_ids JSONB;

-- Down Migration
ALTER TABLE agent_templates DROP COLUMN IF EXISTS allowed_org_ids;
