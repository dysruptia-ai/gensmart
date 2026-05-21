-- Up Migration
-- Adds a per-profile "health check" tool call that the MCP Test Connection
-- endpoint can invoke to validate end-to-end credentials (not just the
-- MCP handshake). NULL = legacy behaviour (handshake-only).
--
-- See MCPConfigurator.tsx (B3 hotfix, Day 20) and
-- routes/agents.ts → POST /:id/tools/mcp/test-connection.
ALTER TABLE mcp_provider_profiles
  ADD COLUMN IF NOT EXISTS health_check_tool JSONB DEFAULT NULL;

COMMENT ON COLUMN mcp_provider_profiles.health_check_tool IS
  'Lightweight tool call for E2E auth validation. Format: {"name":"tool_name","params":{...}}. NULL = handshake-only validation.';

-- Seed Mastershop's health check: a cheap product search that requires
-- the customer API key to succeed.
UPDATE mcp_provider_profiles
  SET health_check_tool = '{"name": "search_my_products", "params": {"search": "test", "limit": 1}}'::jsonb,
      updated_at = NOW()
  WHERE id = 'mastershop';

-- Down Migration
ALTER TABLE mcp_provider_profiles
  DROP COLUMN IF EXISTS health_check_tool;
