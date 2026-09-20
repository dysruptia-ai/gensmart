-- Up Migration
-- Backfill: agentes con la tool MCP de Tiendanube que quedaron sin el canal
-- 'web' (createFromTemplate deja channels=[]). Idempotente: no toca los que ya lo tienen.
UPDATE agents
   SET channels = (
     SELECT jsonb_agg(DISTINCT elem ORDER BY elem)
     FROM jsonb_array_elements_text(COALESCE(channels, '[]'::jsonb) || '["web"]'::jsonb) elem
   )
 WHERE id IN (
   SELECT t.agent_id FROM agent_tools t
   WHERE t.type = 'mcp' AND t.config->>'providerId' = 'tiendanube'
 )
 AND NOT (COALESCE(channels, '[]'::jsonb) ? 'web');

-- Down Migration
-- Sin reversa: no se puede distinguir qué agentes ya tenían 'web' antes.
SELECT 1;
