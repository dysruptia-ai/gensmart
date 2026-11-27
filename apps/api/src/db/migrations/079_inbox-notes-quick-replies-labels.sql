-- Up Migration
-- Bandeja (web-43): notas internas, respuestas rápidas y etiquetas de conversación. Aditiva.
--
-- conversation_notes: solo las lee la Bandeja. El agente nunca las recibe (el worker arma su
-- historial con `messages`), ni el scoring, ni el resumen, ni el canal.

CREATE TABLE IF NOT EXISTS conversation_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  author_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Borrado lógico: Actividad dice quién la borró; la API nunca devuelve el cuerpo de una borrada
  deleted_at TIMESTAMPTZ NULL,
  deleted_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_conversation_notes_conversation
  ON conversation_notes (conversation_id, created_at);

ALTER TABLE conversation_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_notes FORCE ROW LEVEL SECURITY;
CREATE POLICY org_isolation_conversation_notes ON conversation_notes
  USING (
    organization_id::text = COALESCE(current_setting('app.current_org_id', true), organization_id::text)
  );

-- Respuestas rápidas: el atajo se guarda sin la "/" y en minúsculas
CREATE TABLE IF NOT EXISTS quick_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  shortcut TEXT NOT NULL,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  use_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_quick_replies_org_shortcut
  ON quick_replies (organization_id, lower(shortcut));

ALTER TABLE quick_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE quick_replies FORCE ROW LEVEL SECURITY;
CREATE POLICY org_isolation_quick_replies ON quick_replies
  USING (
    organization_id::text = COALESCE(current_setting('app.current_org_id', true), organization_id::text)
  );

-- Catálogo de etiquetas de la Bandeja (de la conversación, no del contacto: contacts.tags no se toca)
CREATE TABLE IF NOT EXISTS inbox_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 30),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_inbox_labels_org_name
  ON inbox_labels (organization_id, lower(name));

ALTER TABLE inbox_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_labels FORCE ROW LEVEL SECURITY;
CREATE POLICY org_isolation_inbox_labels ON inbox_labels
  USING (
    organization_id::text = COALESCE(current_setting('app.current_org_id', true), organization_id::text)
  );

CREATE TABLE IF NOT EXISTS conversation_labels (
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES inbox_labels(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  added_by UUID REFERENCES users(id) ON DELETE SET NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (conversation_id, label_id)
);

-- Conteos por etiqueta y las vistas por etiqueta (web-44)
CREATE INDEX IF NOT EXISTS idx_conversation_labels_org_label
  ON conversation_labels (organization_id, label_id);

ALTER TABLE conversation_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_labels FORCE ROW LEVEL SECURITY;
CREATE POLICY org_isolation_conversation_labels ON conversation_labels
  USING (
    organization_id::text = COALESCE(current_setting('app.current_org_id', true), organization_id::text)
  );

-- Historial: "X borró una nota" (sin el texto)
ALTER TABLE conversation_events DROP CONSTRAINT IF EXISTS conversation_events_type_check;
ALTER TABLE conversation_events ADD CONSTRAINT conversation_events_type_check CHECK (type IN (
  'handoff_requested', 'taken', 'released', 'transferred', 'snoozed', 'unsnoozed', 'closed', 'reopened',
  'note_deleted'
));

-- Down Migration
DELETE FROM conversation_events WHERE type = 'note_deleted';
ALTER TABLE conversation_events DROP CONSTRAINT IF EXISTS conversation_events_type_check;
ALTER TABLE conversation_events ADD CONSTRAINT conversation_events_type_check CHECK (type IN (
  'handoff_requested', 'taken', 'released', 'transferred', 'snoozed', 'unsnoozed', 'closed', 'reopened'
));
DROP POLICY IF EXISTS org_isolation_conversation_labels ON conversation_labels;
DROP TABLE IF EXISTS conversation_labels;
DROP POLICY IF EXISTS org_isolation_inbox_labels ON inbox_labels;
DROP TABLE IF EXISTS inbox_labels;
DROP POLICY IF EXISTS org_isolation_quick_replies ON quick_replies;
DROP TABLE IF EXISTS quick_replies;
DROP POLICY IF EXISTS org_isolation_conversation_notes ON conversation_notes;
DROP TABLE IF EXISTS conversation_notes;
