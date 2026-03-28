-- Up Migration
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT FALSE;

-- Down Migration
ALTER TABLE users DROP COLUMN IF EXISTS is_super_admin;
