-- Up Migration
-- Configurable trial length for orgs that register without a promo code. Read via the same
-- platform-settings.service.ts mechanism as the existing WhatsApp/MCP provider settings — no new
-- admin UI code needed, the settings page already renders any row here generically.
INSERT INTO platform_settings (key, value, is_encrypted, description) VALUES
  ('trial_duration_days', '15', false, 'Number of days a new organization''s trial lasts when no promo code is applied at registration');

-- Down Migration
DELETE FROM platform_settings WHERE key = 'trial_duration_days';
