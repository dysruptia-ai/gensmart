-- Up Migration
-- Venndelo MCP Provider Profile + master API key platform setting.
-- Mismo patrón que Mastershop / WooCommerce / Tiendanube (ver 038, 044, 047).
--
-- Venndelo es una plataforma colombiana de dropshipping tipo marketplace.
-- Multi-tenant: cada cliente conecta su tienda con el refresh token OAuth que
-- genera en Venndelo → Integraciones → tarjeta "Gensmart" → Conectar →
-- "OAuth Refresh Token" → Generar credencial, y lo pega como header
-- X-Venndelo-Refresh-Token. El client_id/client_secret de la app de Venndelo
-- viven solo en el servidor MCP; GenSmart nunca los ve.
--
-- X-MCP-API-Key se auto-inyecta desde el platform setting
-- `venndelo_mcp_api_key` (valida a la plataforma). X-Agent-ID, X-Session-ID y
-- X-Webhook-Secret ya los inyecta GenSmart en todas las tools MCP.
-- NO se inyecta X-Webhook-URL todavía: los webhooks de Venndelo llegan en una
-- fase posterior (supported_events queda vacío).
--
-- health_check_tool usa search_products (limit 1): es la tool más liviana y
-- exige un refresh token válido. requires_oauth_connect (068) toma su default
-- false: Venndelo usa un token pegado a mano, no un flujo OAuth de conexión.

INSERT INTO mcp_provider_profiles (
  id, name, description, match_url_pattern, match_strategy,
  default_transport, default_server_url,
  auto_injected_headers, user_configurable_headers, supported_events,
  health_check_tool
) VALUES (
  'venndelo',
  'Venndelo Dropshipping',
  'Plataforma colombiana de dropshipping (marketplace de proveedores): búsqueda de productos, carrito por conversación, cotización de envío y pedidos contraentrega. Multi-tenant: cada cliente conecta su tienda con el refresh token que genera en Venndelo → Integraciones → Gensmart.',
  'venndelo-mcp.gensmart.co',
  'domain_contains',
  'streamable-http',
  'https://venndelo-mcp.gensmart.co/mcp',
  '[
    {
      "key": "X-MCP-API-Key",
      "value_ref": "platform_setting:venndelo_mcp_api_key",
      "description": "Master API key shared between GenSmart and the Venndelo MCP server (validates the platform itself)."
    }
  ]'::jsonb,
  '[
    {
      "key": "X-Venndelo-Refresh-Token",
      "label_en": "Your Venndelo refresh token",
      "label_es": "Tu refresh token de Venndelo",
      "help_url": "https://app.venndelo.com/admin/integrations",
      "help_text_en": "In your Venndelo dashboard go to Integrations → Gensmart → Connect, choose \"OAuth Refresh Token\" and click Generate credential. Paste the token here. If you rotate it in Venndelo, update it here too.",
      "help_text_es": "En tu panel de Venndelo entra a Integraciones → Gensmart → Conectar, elige \"OAuth Refresh Token\" y da clic en Generar credencial. Pega aquí el token. Si lo rotas en Venndelo, actualízalo también aquí.",
      "required": true,
      "min_length": 20
    }
  ]'::jsonb,
  '[]'::jsonb,
  '{"name": "search_products", "params": {"limit": 1}}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO platform_settings (key, value, is_encrypted, description) VALUES
  ('venndelo_mcp_api_key', '', true, 'Master API key for connecting to Venndelo MCP. Configured by Genner as MCP admin.')
ON CONFLICT (key) DO NOTHING;

-- Down Migration
DELETE FROM platform_settings WHERE key = 'venndelo_mcp_api_key';
DELETE FROM mcp_provider_profiles WHERE id = 'venndelo';
