-- Up Migration
-- Day 20 B3 completion — Adds end-to-end health check tool to the Synchroteam
-- provider profile. Mirrors the Mastershop pattern from migration 039.
--
-- get_job_types is the lightest tool exposed by synchroteam-mcp:
--   - No required parameters
--   - Requires X-Synchroteam-Domain + X-Synchroteam-ApiKey to succeed
--   - Already validated E2E in production with the Ylen Cooling & Heating tenant
--
-- A bad/revoked Synchroteam API key now returns AUTH_FAILED in Test Connection
-- instead of a misleading handshake_only success.
UPDATE mcp_provider_profiles
  SET health_check_tool = '{"name": "get_job_types", "params": {}}'::jsonb,
      updated_at = NOW()
  WHERE id = 'synchroteam';

-- Down Migration
UPDATE mcp_provider_profiles
  SET health_check_tool = NULL,
      updated_at = NOW()
  WHERE id = 'synchroteam';
