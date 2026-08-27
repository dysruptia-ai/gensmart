-- Up Migration
-- Adds end-to-end health check tool to the WooCommerce provider profile.
-- Mirrors the Mastershop/Synchroteam pattern from migrations 039/042.
--
-- check_shipping_zones is the lightest tool exposed by woocommerce-mcp:
--   - inputSchema is {} (no required parameters)
--   - Requires X-Site-URL + X-Consumer-Key + X-Consumer-Secret to succeed
--     against the real WooCommerce REST API
--
-- A bad/revoked consumer key/secret now returns AUTH_FAILED in Test Connection
-- instead of a misleading handshake_only success.
UPDATE mcp_provider_profiles
  SET health_check_tool = '{"name": "check_shipping_zones", "params": {}}'::jsonb,
      updated_at = NOW()
  WHERE id = 'woocommerce';

-- Down Migration
UPDATE mcp_provider_profiles
  SET health_check_tool = NULL,
      updated_at = NOW()
  WHERE id = 'woocommerce';
