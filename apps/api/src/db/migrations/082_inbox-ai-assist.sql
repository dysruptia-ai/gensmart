-- Up Migration
-- Bandeja (web-46): resumen del agente y respuestas sugeridas con IA. Aditiva. El interruptor queda
-- encendido por defecto por decisión del usuario (gasta mensajes del plan desde Starter; en Solo no se
-- genera nada). La causa y el team_summary del pedido de ayuda van en conversation_events.data.

ALTER TABLE inbox_settings ADD COLUMN IF NOT EXISTS ai_assist_enabled BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS conversation_ai_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('summary', 'suggestions')),
  -- summary: id del evento handoff_requested; suggestions: id del mensaje del cliente
  anchor_id UUID NOT NULL,
  -- {} mientras está reservada (generándose); luego { text } o { suggestions: [...] }
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  model TEXT NULL,
  counted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- impide cobrar dos veces la misma generación
  CONSTRAINT conversation_ai_outputs_anchor_unique UNIQUE (conversation_id, kind, anchor_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_ai_outputs_conv
  ON conversation_ai_outputs (conversation_id, kind, created_at DESC);

ALTER TABLE conversation_ai_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_ai_outputs FORCE ROW LEVEL SECURITY;
CREATE POLICY org_isolation_conversation_ai_outputs ON conversation_ai_outputs
  USING (
    organization_id::text = COALESCE(current_setting('app.current_org_id', true), organization_id::text)
  );

-- Down Migration
DROP TABLE IF EXISTS conversation_ai_outputs;
ALTER TABLE inbox_settings DROP COLUMN IF EXISTS ai_assist_enabled;
