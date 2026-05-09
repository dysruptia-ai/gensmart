-- Up Migration
-- MCP Provider Profiles: pre-configured catalog of known MCP providers
-- (Mastershop, Dropi, Zendrop, ...). Profiles let GenSmart auto-inject
-- platform-level credentials (master keys, fixed webhook URLs) and show
-- guided UI with only the headers the customer needs to fill (typically 1).
-- See docs/INTEGRATION.md and the MCP-INT-2 sprint design.
--
-- value_ref prefixes (auto_injected_headers):
--   "platform_setting:foo" → resolved at runtime via platform_settings.foo
--   "fixed:literal_string" → literal string injected as-is
CREATE TABLE IF NOT EXISTS mcp_provider_profiles (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  logo_url TEXT,
  match_url_pattern TEXT NOT NULL,
  match_strategy VARCHAR(20) DEFAULT 'domain_contains' CHECK (match_strategy IN ('domain_contains', 'domain_exact', 'url_prefix', 'regex')),
  default_transport VARCHAR(20) DEFAULT 'streamable-http' CHECK (default_transport IN ('sse', 'streamable-http')),
  default_server_url TEXT,
  auto_injected_headers JSONB DEFAULT '[]',
  user_configurable_headers JSONB DEFAULT '[]',
  supported_events JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mcp_providers_active ON mcp_provider_profiles(is_active) WHERE is_active = true;

INSERT INTO mcp_provider_profiles (
  id, name, description, match_url_pattern, match_strategy,
  default_transport, default_server_url,
  auto_injected_headers, user_configurable_headers, supported_events
) VALUES (
  'mastershop',
  'Mastershop Dropshipping',
  'Plataforma de dropshipping LATAM con búsqueda de productos, carrito, órdenes y tracking',
  'mastershop-mcp.gensmart.co',
  'domain_contains',
  'streamable-http',
  'https://mastershop-mcp.gensmart.co/mcp',
  '[
    {"key": "X-MCP-API-Key", "value_ref": "platform_setting:mastershop_mcp_api_key", "description": "Master API key for Mastershop MCP"},
    {"key": "X-Webhook-URL", "value_ref": "fixed:https://api.gensmart.co/api/webhooks/mcp", "description": "GenSmart webhook receiver endpoint"}
  ]'::jsonb,
  '[
    {
      "key": "X-Mastershop-Api-Key",
      "label_en": "Your Mastershop API Key",
      "label_es": "Tu API Key de Mastershop",
      "help_url": "https://mastershop.com/docs/api-keys",
      "help_text_en": "Get your API key from your Mastershop dashboard → Settings → API Access",
      "help_text_es": "Obtén tu API key desde tu dashboard de Mastershop → Configuración → Acceso API",
      "required": true,
      "min_length": 16
    }
  ]'::jsonb,
  '["order.created", "order.status_changed", "order.guide_generated", "order.delivered", "order.incident"]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO platform_settings (key, value, is_encrypted, description) VALUES
  ('mastershop_mcp_api_key', '', true, 'Master API key for connecting to Mastershop MCP. Configured by Genner as MCP admin.')
ON CONFLICT (key) DO NOTHING;

-- Down Migration
DELETE FROM platform_settings WHERE key = 'mastershop_mcp_api_key';
DROP TABLE IF EXISTS mcp_provider_profiles CASCADE;
