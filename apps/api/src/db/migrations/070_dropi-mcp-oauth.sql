-- Up Migration
-- Dropi MCP (OAuth 2.1 / PKCE, public client) + beta gating per organization.
--
-- Dropi no usa API key: cada cliente conecta su cuenta de Dropi con OAuth y
-- GenSmart actúa como cliente público (sin client_secret). El client_id vive en
-- platform_settings (no es secreto) y se resuelve vía oauth_config.client_id_ref.
--
-- allowed_org_ids: NULL = visible para todas las orgs; array de UUIDs = solo esas.
-- El perfil dropi nace con '[]' (oculto para todos) hasta que se habilite una org.
--
-- default_selected_tools: tools que se seleccionan en la PRIMERA conexión OAuth
-- (intersección con las descubiertas). NULL = todas (comportamiento previo de los
-- demás perfiles). Para dropi solo catálogo/logística de solo lectura y sin datos
-- personales: create_order, get_order, list_orders y get_customer_fingerprint_profile
-- quedan fuera (se habilitarán desde la plantilla con controles en servidor).

ALTER TABLE mcp_provider_profiles ADD COLUMN IF NOT EXISTS oauth_config JSONB;
ALTER TABLE mcp_provider_profiles ADD COLUMN IF NOT EXISTS allowed_org_ids JSONB;
ALTER TABLE mcp_provider_profiles ADD COLUMN IF NOT EXISTS default_selected_tools JSONB;

INSERT INTO mcp_provider_profiles (
  id, name, description, match_url_pattern, match_strategy,
  default_transport, default_server_url,
  auto_injected_headers, user_configurable_headers, supported_events,
  health_check_tool, requires_oauth_connect, is_active,
  oauth_config, allowed_org_ids, default_selected_tools
) VALUES (
  'dropi',
  'Dropi',
  'Plataforma de dropshipping de LatAm: catálogo de productos, cotización de envíos, creación y seguimiento de órdenes. Cada cliente conecta su propia cuenta de Dropi con OAuth.',
  'mcp.dropi.co',
  'domain_exact',
  'streamable-http',
  'https://mcp.dropi.co/mcp',
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  '{"name": "list_products", "params": {"page_size": 1}}'::jsonb,
  true,
  true,
  '{
    "authorization_endpoint": "https://oauth.dropi.co/oauth/authorize",
    "token_endpoint": "https://integrations.dropi.co/oauth/token",
    "revocation_endpoint": "https://integrations.dropi.co/oauth/revoke",
    "client_id_ref": "platform_setting:dropi_oauth_client_id",
    "scope": "mcp",
    "resource": "https://mcp.dropi.co/mcp"
  }'::jsonb,
  '[]'::jsonb,
  '["list_products","list_categories","quote_shipping","search_cities","list_departments","list_carriers","list_statuses"]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO platform_settings (key, value, is_encrypted, description) VALUES
  ('dropi_oauth_client_id', 'gensmart-8d637714', false, 'OAuth client_id (public client, PKCE) registered with Dropi for GenSmart. Not a secret.')
ON CONFLICT (key) DO NOTHING;

-- Down Migration
-- Tokens OAuth (cifrados) guardados en tools MCP: no deben sobrevivir al rollback.
UPDATE agent_tools SET config = config - 'oauth' WHERE config ? 'oauth';
DELETE FROM platform_settings WHERE key = 'dropi_oauth_client_id';
DELETE FROM mcp_provider_profiles WHERE id = 'dropi';
ALTER TABLE mcp_provider_profiles DROP COLUMN IF EXISTS default_selected_tools;
ALTER TABLE mcp_provider_profiles DROP COLUMN IF EXISTS allowed_org_ids;
ALTER TABLE mcp_provider_profiles DROP COLUMN IF EXISTS oauth_config;
