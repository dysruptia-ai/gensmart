-- Up Migration
-- Bandeja (web-45): reparto automático, horario y meta de respuesta, pausar un agente y canal
-- desconectado. Aditiva: sin fila en inbox_settings valen los valores por defecto (modo 'none' y sin
-- horario), así que ninguna organización cambia de comportamiento.

CREATE TABLE IF NOT EXISTS inbox_settings (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  assignment_mode TEXT NOT NULL DEFAULT 'none' CHECK (assignment_mode IN ('rotating', 'agent', 'none')),
  keep_last_person BOOLEAN NOT NULL DEFAULT false,
  -- null = siempre abierto; si no, { "1": {"open":"08:00","close":"18:00"}, …, "7": null } (1 = lunes)
  business_hours JSONB NULL,
  out_of_hours_notice BOOLEAN NOT NULL DEFAULT false,
  response_goal_minutes INTEGER NOT NULL DEFAULT 15 CHECK (response_goal_minutes BETWEEN 1 AND 240),
  alert_email_minutes INTEGER NULL CHECK (
    alert_email_minutes IS NULL OR (alert_email_minutes > response_goal_minutes AND alert_email_minutes <= 1440)
  ),
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE inbox_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_settings FORCE ROW LEVEL SECURITY;
CREATE POLICY org_isolation_inbox_settings ON inbox_settings
  USING (
    organization_id::text = COALESCE(current_setting('app.current_org_id', true), organization_id::text)
  );

CREATE TABLE IF NOT EXISTS inbox_member_settings (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  capacity INTEGER NOT NULL DEFAULT 8 CHECK (capacity BETWEEN 1 AND 100),
  receives BOOLEAN NOT NULL DEFAULT true,
  last_assigned_at TIMESTAMPTZ NULL,
  PRIMARY KEY (organization_id, user_id)
);

ALTER TABLE inbox_member_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_member_settings FORCE ROW LEVEL SECURITY;
CREATE POLICY org_isolation_inbox_member_settings ON inbox_member_settings
  USING (
    organization_id::text = COALESCE(current_setting('app.current_org_id', true), organization_id::text)
  );

-- La persona responsable de cada agente en el modo "por agente"
CREATE TABLE IF NOT EXISTS inbox_agent_assignees (
  agent_id UUID PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_inbox_agent_assignees_org ON inbox_agent_assignees (organization_id);

ALTER TABLE inbox_agent_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_agent_assignees FORCE ROW LEVEL SECURITY;
CREATE POLICY org_isolation_inbox_agent_assignees ON inbox_agent_assignees
  USING (
    organization_id::text = COALESCE(current_setting('app.current_org_id', true), organization_id::text)
  );

-- Pausar el agente en la Bandeja: no toca `status` (sigue publicado)
ALTER TABLE agents ADD COLUMN IF NOT EXISTS inbox_paused_at TIMESTAMPTZ NULL;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS inbox_paused_by UUID NULL REFERENCES users(id) ON DELETE SET NULL;

-- El correo de la meta se manda una vez por pedido de ayuda
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS wait_alert_sent_at TIMESTAMPTZ NULL;

CREATE TABLE IF NOT EXISTS agent_channel_health (
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  failing_since TIMESTAMPTZ NOT NULL,
  last_error_code TEXT,
  last_error_at TIMESTAMPTZ NOT NULL,
  notified_at TIMESTAMPTZ NULL,
  PRIMARY KEY (agent_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_agent_channel_health_org ON agent_channel_health (organization_id);

ALTER TABLE agent_channel_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_channel_health FORCE ROW LEVEL SECURITY;
CREATE POLICY org_isolation_agent_channel_health ON agent_channel_health
  USING (
    organization_id::text = COALESCE(current_setting('app.current_org_id', true), organization_id::text)
  );

-- Historial: "Se asignó a X" (reparto automático)
ALTER TABLE conversation_events DROP CONSTRAINT IF EXISTS conversation_events_type_check;
ALTER TABLE conversation_events ADD CONSTRAINT conversation_events_type_check CHECK (type IN (
  'handoff_requested', 'taken', 'released', 'transferred', 'snoozed', 'unsnoozed', 'closed', 'reopened',
  'note_deleted', 'assigned'
));

-- Down Migration
DELETE FROM conversation_events WHERE type = 'assigned';
ALTER TABLE conversation_events DROP CONSTRAINT IF EXISTS conversation_events_type_check;
ALTER TABLE conversation_events ADD CONSTRAINT conversation_events_type_check CHECK (type IN (
  'handoff_requested', 'taken', 'released', 'transferred', 'snoozed', 'unsnoozed', 'closed', 'reopened',
  'note_deleted'
));
DROP POLICY IF EXISTS org_isolation_agent_channel_health ON agent_channel_health;
DROP TABLE IF EXISTS agent_channel_health;
ALTER TABLE conversations DROP COLUMN IF EXISTS wait_alert_sent_at;
ALTER TABLE agents DROP COLUMN IF EXISTS inbox_paused_by;
ALTER TABLE agents DROP COLUMN IF EXISTS inbox_paused_at;
DROP POLICY IF EXISTS org_isolation_inbox_agent_assignees ON inbox_agent_assignees;
DROP TABLE IF EXISTS inbox_agent_assignees;
DROP POLICY IF EXISTS org_isolation_inbox_member_settings ON inbox_member_settings;
DROP TABLE IF EXISTS inbox_member_settings;
DROP POLICY IF EXISTS org_isolation_inbox_settings ON inbox_settings;
DROP TABLE IF EXISTS inbox_settings;
