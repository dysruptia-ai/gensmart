-- Up Migration
-- Bandeja (web-42): historial de eventos, posponer y cerrar con resultado. Aditiva: una tabla nueva
-- y columnas opcionales en conversations; no se borra ni se renombra nada.
--
-- conversation_events: lo que pasó con la conversación (quién la tomó, transfirió, pospuso, cerró…).
-- Solo la lee la Bandeja: el agente nunca la recibe en su historial (el worker lee `messages`).

CREATE TABLE IF NOT EXISTS conversation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL CHECK (type IN (
    'handoff_requested', 'taken', 'released', 'transferred', 'snoozed', 'unsnoozed', 'closed', 'reopened'
  )),
  -- NULL si lo hizo el sistema o el agente
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  -- NULL si no aplica (solo transferred lo usa)
  target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  -- La nota de la transferencia, el resultado del cierre, hasta cuándo se pospuso…
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversation_events_conversation
  ON conversation_events (conversation_id, created_at);

ALTER TABLE conversation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_events FORCE ROW LEVEL SECURITY;
CREATE POLICY org_isolation_conversation_events ON conversation_events
  USING (
    organization_id::text = COALESCE(current_setting('app.current_org_id', true), organization_id::text)
  );

-- Posponer: hasta cuándo y quién (la lista la saca de "Todas", "Necesitan" y "En curso"; el cron la busca).
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ NULL;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS snoozed_by UUID NULL REFERENCES users(id) ON DELETE SET NULL;
-- La hora en que una conversación pospuesta volvió ("Seguimiento para hoy").
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS follow_up_at TIMESTAMPTZ NULL;
-- Cerrar con resultado (el filtro de "Cerradas" y la barra de cerrada).
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS closed_outcome TEXT NULL
  CHECK (closed_outcome IS NULL OR closed_outcome IN ('sold', 'resolved', 'no_response', 'spam'));
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ NULL;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS closed_by UUID NULL REFERENCES users(id) ON DELETE SET NULL;
-- web-42b: cuándo alguien atendió el último pedido de ayuda (al tomarla o recibirla por transferencia).
-- El pedido solo está vigente para la Bandeja si handoff_attended_at es NULL o anterior a handed_off_at.
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS handoff_attended_at TIMESTAMPTZ NULL;

-- El cron de cada minuto solo mira las pospuestas
CREATE INDEX IF NOT EXISTS idx_conversations_snoozed_until
  ON conversations (snoozed_until) WHERE snoozed_until IS NOT NULL;
-- Filtro por resultado en "Cerradas"
CREATE INDEX IF NOT EXISTS idx_conversations_closed_outcome
  ON conversations (organization_id, closed_outcome) WHERE closed_outcome IS NOT NULL;

-- Down Migration
DROP INDEX IF EXISTS idx_conversations_closed_outcome;
DROP INDEX IF EXISTS idx_conversations_snoozed_until;
ALTER TABLE conversations DROP COLUMN IF EXISTS handoff_attended_at;
ALTER TABLE conversations DROP COLUMN IF EXISTS closed_by;
ALTER TABLE conversations DROP COLUMN IF EXISTS closed_at;
ALTER TABLE conversations DROP COLUMN IF EXISTS closed_outcome;
ALTER TABLE conversations DROP COLUMN IF EXISTS follow_up_at;
ALTER TABLE conversations DROP COLUMN IF EXISTS snoozed_by;
ALTER TABLE conversations DROP COLUMN IF EXISTS snoozed_until;
DROP POLICY IF EXISTS org_isolation_conversation_events ON conversation_events;
DROP TABLE IF EXISTS conversation_events;
