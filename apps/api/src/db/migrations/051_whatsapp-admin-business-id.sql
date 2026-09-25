-- Up Migration
INSERT INTO platform_settings (key, value, is_encrypted, description) VALUES
  ('whatsapp_admin_business_id', '149776854544754', false, 'Dysruptia Business Manager ID — used to auto-assign client WABAs to the operational system user across businesses.');

-- Down Migration
DELETE FROM platform_settings WHERE key = 'whatsapp_admin_business_id';
