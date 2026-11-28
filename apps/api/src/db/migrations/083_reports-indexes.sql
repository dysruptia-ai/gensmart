-- Up Migration
-- Informes (web-47). Aditiva: solo índices. Los pedidos de ayuda del período se buscan por organización,
-- tipo y fecha (sin este índice se recorre el de conversation_id entero), y la base de conversaciones se
-- acota por last_message_at dentro de la organización. En producción, crearlos antes con
-- CREATE INDEX CONCURRENTLY (ver el reporte de web-47); con IF NOT EXISTS esta migración no hace nada.

CREATE INDEX IF NOT EXISTS idx_conversation_events_org_type_created
  ON conversation_events (organization_id, type, created_at);

CREATE INDEX IF NOT EXISTS idx_conversations_org_last_message
  ON conversations (organization_id, last_message_at);

-- Down Migration
DROP INDEX IF EXISTS idx_conversations_org_last_message;
DROP INDEX IF EXISTS idx_conversation_events_org_type_created;
