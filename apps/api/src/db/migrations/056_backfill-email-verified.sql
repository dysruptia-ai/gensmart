-- Up Migration
-- Respaldo histórico: hasta hace unas horas ningún usuario tenía email_verified=true
-- (la columna existía pero nunca se poblaba). Las ~7000 cuentas falsas del ataque del
-- 22 oct 2026 ya fueron eliminadas por separado (ver checkpoint de seguridad). Todo lo
-- que queda en esta tabla en este momento es legítimo — se marca como verificado para
-- no bloquear el login de clientes reales cuando entre en vigor el nuevo gate de
-- email_verified en login().
UPDATE users SET email_verified = true, updated_at = NOW() WHERE email_verified = false;

-- Down Migration
-- Deliberadamente no reversible: no hay forma de saber cuáles de estas filas estaban
-- realmente sin verificar antes de este backfill. Un rollback no debe re-bloquear
-- cuentas reales.
