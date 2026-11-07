-- Up Migration
-- Agrega `store_id` como user_configurable_header del provider profile de
-- Tiendanube, mapeado al header X-Store-ID.
--
-- Esto NO toca el flujo de auto-provisioning real (OAuth):
-- tiendanube-provisioning.service.ts sigue escribiendo X-Store-ID directo en
-- agent_tools.config.headers, sin pasar por este campo.
--
-- Lo que SÍ habilita: que al crear un agente manualmente (ej. desde el nuevo
-- template "Tiendanube Store Assistant") y conectar la tool MCP "Tiendanube
-- Store" desde la pestaña Tools del editor, aparezca un campo "Store ID" para
-- escribir — hoy ese campo no existe porque user_configurable_headers estaba
-- vacío (ver comentario en 047_tiendanube-mcp.sql). El mecanismo de render ya
-- es genérico (ToolConfigurator.tsx renderiza un input por cada entrada de
-- user_configurable_headers) — no hace falta tocar frontend.
--
-- Importante: esto NO crea un tenant nuevo del lado de tiendanube-mcp. Solo
-- sirve para re-usar el store_id de una tienda que YA completó el instalación
-- OAuth real de la app (tenantAuthMiddleware.ts solo resuelve tenants
-- existentes, nunca los crea on-the-fly). Para una tienda que nunca instaló
-- la app, este campo no sirve de nada — hay que instalar la app de verdad
-- primero.
UPDATE mcp_provider_profiles
SET user_configurable_headers = '[
  {
    "key": "X-Store-ID",
    "label_en": "Tiendanube Store ID",
    "label_es": "ID de la tienda Tiendanube",
    "help_text_en": "Numeric store_id of a Tiendanube store that has ALREADY installed the GenSmart app through the real OAuth flow. Will not work for a store that has never installed the app.",
    "help_text_es": "store_id numérico de una tienda Tiendanube que YA instaló la app de GenSmart por el flujo OAuth real. No funciona para una tienda que nunca instaló la app.",
    "required": true,
    "min_length": 1
  }
]'::jsonb,
    updated_at = NOW()
WHERE id = 'tiendanube';

-- Down Migration
UPDATE mcp_provider_profiles
SET user_configurable_headers = '[]'::jsonb,
    updated_at = NOW()
WHERE id = 'tiendanube';
