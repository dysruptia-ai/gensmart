-- Up Migration
-- WooCommerce MCP Provider Profile + master API key platform setting.
-- Mirror of the Mastershop/Synchroteam pattern (see migrations 038, 041).
--
-- WooCommerce is an e-commerce platform (WordPress). Multi-tenant: each
-- customer connects their own WooCommerce store via site URL + REST API
-- consumer key/secret, passed as MCP headers.

INSERT INTO mcp_provider_profiles (
  id, name, description, match_url_pattern, match_strategy,
  default_transport, default_server_url,
  auto_injected_headers, user_configurable_headers, supported_events
) VALUES (
  'woocommerce',
  'WooCommerce Store',
  'Tiendas WooCommerce/WordPress: búsqueda de productos, zonas de envío y creación de pedidos con link de pago nativo. Multi-tenant: cada cliente conecta su propia tienda vía URL + API keys de WooCommerce.',
  'woocommerce-mcp.gensmart.co',
  'domain_contains',
  'streamable-http',
  'https://woocommerce-mcp.gensmart.co/mcp',
  '[
    {
      "key": "X-MCP-API-Key",
      "value_ref": "platform_setting:woocommerce_mcp_api_key",
      "description": "Master API key shared between GenSmart and the WooCommerce MCP server (validates the platform itself)."
    }
  ]'::jsonb,
  '[
    {
      "key": "X-Site-URL",
      "label_en": "Store URL",
      "label_es": "URL de la tienda",
      "help_text_en": "Full URL of the WooCommerce store, including https://. Example: https://yourstore.com",
      "help_text_es": "URL completa de la tienda WooCommerce, incluyendo https://. Ejemplo: https://tutienda.com",
      "required": true,
      "min_length": 10
    },
    {
      "key": "X-Consumer-Key",
      "label_en": "Consumer Key",
      "label_es": "Consumer Key",
      "help_text_en": "Find this in WooCommerce > Settings > Advanced > REST API. Create a key with Read/Write permissions.",
      "help_text_es": "Encuéntrala en WooCommerce > Ajustes > Avanzado > API REST. Crea una clave con permisos de Lectura/Escritura.",
      "required": true,
      "min_length": 20
    },
    {
      "key": "X-Consumer-Secret",
      "label_en": "Consumer Secret",
      "label_es": "Consumer Secret",
      "help_text_en": "Generated together with the Consumer Key in the same WooCommerce REST API screen.",
      "help_text_es": "Se genera junto con el Consumer Key en la misma pantalla de API REST de WooCommerce.",
      "required": true,
      "min_length": 20
    }
  ]'::jsonb,
  '[]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO platform_settings (key, value, is_encrypted, description) VALUES
  ('woocommerce_mcp_api_key', '', true, 'Master API key for connecting to WooCommerce MCP. Configured by Genner as MCP admin.')
ON CONFLICT (key) DO NOTHING;

-- Down Migration
DELETE FROM platform_settings WHERE key = 'woocommerce_mcp_api_key';
DELETE FROM mcp_provider_profiles WHERE id = 'woocommerce';
