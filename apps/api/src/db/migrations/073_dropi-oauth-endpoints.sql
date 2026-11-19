-- Up Migration
-- Dropi movió su authorization server a mcp.dropi.co el 2026-11-19; endpoints
-- tomados de su metadata RFC 8414 (https://mcp.dropi.co/.well-known/oauth-authorization-server).
-- El servidor anterior (oauth.dropi.co / integrations.dropi.co) ya no responde.
-- Solo cambian authorization/token/revocation_endpoint: client_id_ref, scope,
-- resource y el resto del perfil se mantienen. No toca agent_tools ni tokens.
-- Idempotente: el merge JSONB deja el mismo resultado si se aplica dos veces.

UPDATE mcp_provider_profiles
SET oauth_config = oauth_config || jsonb_build_object(
  'authorization_endpoint', 'https://mcp.dropi.co/login/authorize',
  'token_endpoint',         'https://mcp.dropi.co/oauth/token',
  'revocation_endpoint',    'https://mcp.dropi.co/oauth/revoke'
)
WHERE id = 'dropi' AND oauth_config IS NOT NULL;

-- Down Migration
UPDATE mcp_provider_profiles
SET oauth_config = oauth_config || jsonb_build_object(
  'authorization_endpoint', 'https://oauth.dropi.co/oauth/authorize',
  'token_endpoint',         'https://integrations.dropi.co/oauth/token',
  'revocation_endpoint',    'https://integrations.dropi.co/oauth/revoke'
)
WHERE id = 'dropi' AND oauth_config IS NOT NULL;
