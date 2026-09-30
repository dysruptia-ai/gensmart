-- Up Migration
DELETE FROM platform_settings
WHERE key IN ('whatsapp_admin_token', 'whatsapp_operational_system_user_id', 'whatsapp_admin_business_id');

-- Down Migration
INSERT INTO platform_settings (key, value, is_encrypted, description) VALUES
  ('whatsapp_admin_token', '', true, 'Meta System User Admin token — used only to auto-assign new WABAs to the operational system user. Never used for messaging operations.'),
  ('whatsapp_operational_system_user_id', '', false, 'The Meta System User ID that operates WhatsApp messaging (e.g. GenSmart API). New WABAs are auto-assigned to this user.'),
  ('whatsapp_admin_business_id', '149776854544754', false, 'Dysruptia Business Manager ID — used to auto-assign client WABAs to the operational system user across businesses.');
