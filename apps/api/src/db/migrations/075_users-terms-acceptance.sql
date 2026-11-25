-- Up Migration
-- Aceptación de los Términos y la Política de privacidad en el registro (web-36).
-- Aditiva: dos columnas opcionales. Los usuarios anteriores quedan en NULL (no aceptaron por esta vía).
-- terms_version = TERMS_VERSION de @gensmart/shared (fecha lastUpdated de los Términos).

ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_version TEXT NULL;

-- Down Migration
ALTER TABLE users DROP COLUMN IF EXISTS terms_version;
ALTER TABLE users DROP COLUMN IF EXISTS terms_accepted_at;
