-- Up Migration
ALTER TABLE email_verifications ADD COLUMN promo_code VARCHAR(50);

-- Down Migration
ALTER TABLE email_verifications DROP COLUMN IF EXISTS promo_code;
