-- Up Migration
-- Tiendanube MCP Provider Profile + master API key platform setting.
-- Mirror of the WooCommerce pattern (see migrations 044, 045), adaptado al
-- modelo OAuth 2 de Tiendanube.
--
-- Diferencia clave con WooCommerce/Mastershop: NO hay credenciales que el
-- cliente pegue a mano. tiendanube-mcp resuelve el access_token real del
-- lado suyo (TenantRegistry, cifrado en SQLite) durante el callback OAuth de
-- instalación de la app — GenSmart nunca ve ni maneja ese token. Por eso
-- `user_configurable_headers` queda vacío: no hay ningún campo que pedirle
-- al cliente en el wizard de conexión manual.
--
-- Punto de diseño para el store_id (resuelto acá, implementado en el
-- auto-provisioning del Día 3):
-- El único dato que GenSmart sí necesita mandar en cada request MCP es el
-- `store_id` de la tienda instalada, para que tiendanube-mcp sepa qué tenant
-- resolver (ver tenantAuthMiddleware, header X-Store-ID). Este dato NO es
-- user_configurable_headers (el cliente no lo tipea — no lo conoce ni debe
-- manejarlo), pero SÍ usa el mismo storage shape que un header configurable
-- por usuario: `agent_tools.config.headers` (array de
-- {key, value_encrypted}, ver mcp-headers.service.ts). La diferencia es
-- quién lo escribe: en vez del usuario vía UI, lo escribe el flujo de
-- auto-provisioning del Día 3 al recibir el evento de instalación OAuth
-- exitosa, con `{key: "X-Store-ID", value_encrypted: encrypt(storeId)}`.
-- No hace falta una columna ni un shape nuevo en agent_tools — reutiliza el
-- mecanismo existente, solo cambia el origen del dato.

INSERT INTO mcp_provider_profiles (
  id, name, description, match_url_pattern, match_strategy,
  default_transport, default_server_url,
  auto_injected_headers, user_configurable_headers, supported_events
) VALUES (
  'tiendanube',
  'Tiendanube Store',
  'Tiendas Tiendanube/Nuvemshop: búsqueda de productos, categorías y creación de pedidos con link de pago nativo. Conexión vía OAuth — no requiere que el cliente pegue API keys manualmente, el store_id se asigna automáticamente al instalar la app de Tiendanube.',
  'tiendanube-mcp.gensmart.co',
  'domain_contains',
  'streamable-http',
  'https://tiendanube-mcp.gensmart.co/mcp',
  '[
    {
      "key": "X-MCP-API-Key",
      "value_ref": "platform_setting:tiendanube_mcp_api_key",
      "description": "Master API key shared between GenSmart and the Tiendanube MCP server (validates the platform itself)."
    }
  ]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO platform_settings (key, value, is_encrypted, description) VALUES
  ('tiendanube_mcp_api_key', '', true, 'Master API key for connecting to Tiendanube MCP. Configured by Genner as MCP admin.')
ON CONFLICT (key) DO NOTHING;

-- Down Migration
DELETE FROM platform_settings WHERE key = 'tiendanube_mcp_api_key';
DELETE FROM mcp_provider_profiles WHERE id = 'tiendanube';
