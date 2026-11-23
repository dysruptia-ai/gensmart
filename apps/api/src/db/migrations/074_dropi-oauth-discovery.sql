-- Up Migration
-- Activa el descubrimiento de endpoints OAuth (RFC 9728 + RFC 8414) para el perfil dropi.
-- Motivo: el 2026-11-19 Dropi movió su authorization server (de integrations.dropi.co /
-- oauth.dropi.co a mcp.dropi.co) y los endpoints fijos dejaron de funcionar (ver 073).
-- Con esto GenSmart usa los endpoints de la metadata de Dropi solo si son https y su host es
-- dropi.co o un subdominio; si no, usa el último bueno o los fijos de oauth_config, y deja un log
-- ALERT. client_id, scope y resource siguen saliendo de oauth_config. No toca agent_tools ni tokens.
-- Idempotente: el merge JSONB deja el mismo resultado si se aplica dos veces.

UPDATE mcp_provider_profiles
SET oauth_config = oauth_config || '{"discovery":{"enabled":true,"allowed_host_suffixes":["dropi.co"]}}'::jsonb
WHERE id = 'dropi' AND oauth_config IS NOT NULL;

-- Down Migration
UPDATE mcp_provider_profiles
SET oauth_config = oauth_config - 'discovery'
WHERE id = 'dropi' AND oauth_config IS NOT NULL;
