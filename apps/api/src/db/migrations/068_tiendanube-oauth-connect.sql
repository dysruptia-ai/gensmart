-- Up Migration
-- Reemplaza el campo manual "Store ID" (067_tiendanube-store-id-header.sql)
-- por un botón de conexión OAuth — causaba confusión en el comerciante, que
-- no tiene forma de saber su store_id de antemano. El nuevo flujo (ver
-- servicio tiendanube-connect-session.service.ts y el endpoint POST
-- /api/internal/tiendanube/attach) resuelve el storeId automáticamente vía
-- OAuth real, sin pedírselo al usuario.
ALTER TABLE mcp_provider_profiles
  ADD COLUMN IF NOT EXISTS requires_oauth_connect BOOLEAN NOT NULL DEFAULT false;

UPDATE mcp_provider_profiles
SET requires_oauth_connect = true,
    user_configurable_headers = '[]'::jsonb,
    updated_at = NOW()
WHERE id = 'tiendanube';

-- Down Migration
UPDATE mcp_provider_profiles
SET requires_oauth_connect = false,
    user_configurable_headers = '[
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

ALTER TABLE mcp_provider_profiles
  DROP COLUMN IF EXISTS requires_oauth_connect;
