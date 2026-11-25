-- Up Migration
-- Ingreso y registro con Google (web-38). Aditiva: tres columnas nuevas en users.
-- google_sub: el `sub` estable de Google (no el correo, que puede cambiar). Único cuando existe.
-- google_linked_at: cuándo se vinculó la cuenta de Google.
-- password_set: FALSE para quien se registró con Google (su password_hash es de una contraseña
-- aleatoria que nadie conoce). Los usuarios existentes quedan en TRUE.

ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub TEXT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_linked_at TIMESTAMPTZ NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_set BOOLEAN NOT NULL DEFAULT TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub ON users (google_sub) WHERE google_sub IS NOT NULL;

-- Down Migration
DROP INDEX IF EXISTS idx_users_google_sub;
ALTER TABLE users DROP COLUMN IF EXISTS password_set;
ALTER TABLE users DROP COLUMN IF EXISTS google_linked_at;
ALTER TABLE users DROP COLUMN IF EXISTS google_sub;
