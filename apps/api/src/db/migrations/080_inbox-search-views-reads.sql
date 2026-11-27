-- Up Migration
-- Bandeja (web-44): búsqueda dentro de los mensajes, vistas guardadas y leído/no leído por persona.
-- Aditiva: extensiones, una función, índices, dos tablas nuevas y una columna con valor por defecto.
--
-- Nada de esto lo lee el agente: el worker arma su historial solo con `messages`.

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- unaccent() sola es STABLE (depende del search_path para encontrar el diccionario), así que no sirve
-- para un índice. Con el diccionario calificado por esquema el resultado solo depende del texto y se
-- puede declarar IMMUTABLE. La búsqueda compara siempre gs_search_norm(columna) con gs_search_norm($q).
CREATE OR REPLACE FUNCTION gs_search_norm(text)
  RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT lower(public.unaccent('public.unaccent'::regdictionary, $1)) $$;

COMMENT ON FUNCTION gs_search_norm(text) IS
  'Bandeja (web-44): minúsculas y sin tildes, inmutable para poder indexarla (unaccent() sola no lo es).';

-- Solo los mensajes que la búsqueda lee: ni `system` ni las notas (que viven en conversation_notes).
-- En producción, si la tabla es grande, crear este índice fuera de la migración con CONCURRENTLY
-- (ver el reporte de web-44); el IF NOT EXISTS deja que la migración lo dé por hecho.
CREATE INDEX IF NOT EXISTS idx_messages_search_trgm
  ON messages USING gin (gs_search_norm(content) gin_trgm_ops)
  WHERE role IN ('user', 'assistant', 'human');

-- Vistas guardadas: personales (solo las ve quien las creó)
CREATE TABLE IF NOT EXISTS inbox_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 40),
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_inbox_views_user_name
  ON inbox_views (organization_id, user_id, lower(btrim(name)));

ALTER TABLE inbox_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_views FORCE ROW LEVEL SECURITY;
CREATE POLICY org_isolation_inbox_views ON inbox_views
  USING (
    organization_id::text = COALESCE(current_setting('app.current_org_id', true), organization_id::text)
  );

-- Leído por persona. marked_unread_at: "Marcar como no leída" (gana hasta la próxima lectura)
CREATE TABLE IF NOT EXISTS conversation_reads (
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL,
  marked_unread_at TIMESTAMPTZ NULL,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_reads_user_org
  ON conversation_reads (user_id, organization_id);

ALTER TABLE conversation_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_reads FORCE ROW LEVEL SECURITY;
CREATE POLICY org_isolation_conversation_reads ON conversation_reads
  USING (
    organization_id::text = COALESCE(current_setting('app.current_org_id', true), organization_id::text)
  );

-- Lo anterior a esta hora cuenta como leído: nadie estrena con cientos de conversaciones en negrita.
-- Las filas que ya existen toman la hora de la migración; quien entre después, la suya.
ALTER TABLE user_organizations ADD COLUMN IF NOT EXISTS inbox_read_since TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Down Migration
-- Las extensiones no se borran (igual que la 001): otras cosas pueden usarlas.
ALTER TABLE user_organizations DROP COLUMN IF EXISTS inbox_read_since;
DROP POLICY IF EXISTS org_isolation_conversation_reads ON conversation_reads;
DROP TABLE IF EXISTS conversation_reads;
DROP POLICY IF EXISTS org_isolation_inbox_views ON inbox_views;
DROP TABLE IF EXISTS inbox_views;
DROP INDEX IF EXISTS idx_messages_search_trgm;
DROP FUNCTION IF EXISTS gs_search_norm(text);
