-- Up Migration
ALTER TABLE calendars ADD COLUMN notification_email VARCHAR(255);

-- Down Migration
ALTER TABLE calendars DROP COLUMN IF EXISTS notification_email;
