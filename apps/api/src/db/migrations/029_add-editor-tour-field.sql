-- Up Migration
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS editor_tour_completed BOOLEAN DEFAULT FALSE;

-- Down Migration
ALTER TABLE users
  DROP COLUMN IF EXISTS editor_tour_completed;
