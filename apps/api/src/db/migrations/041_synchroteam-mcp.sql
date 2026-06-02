-- Up Migration
-- Synchroteam MCP Provider Profile + master API key platform setting.
-- Mirror of the Mastershop pattern (see migration 038).
--
-- Synchroteam is a field service management platform (HVAC, plumbing, electrical, etc.).
-- Multi-tenant: each customer connects their own Synchroteam account via domain + API key
-- and operational parameters (timezone, work hours, scheduling windows) passed as MCP headers.

INSERT INTO mcp_provider_profiles (
  id, name, description, match_url_pattern, match_strategy,
  default_transport, default_server_url,
  auto_injected_headers, user_configurable_headers, supported_events
) VALUES (
  'synchroteam',
  'Synchroteam Field Service',
  'Gestión de field service (HVAC, plomería, electricidad, etc.): jobs, agendamiento por ventanas, customers, technicians y disponibilidad. Multi-tenant: cada cliente conecta su propio Synchroteam vía domain + API key.',
  'synchroteam-mcp.gensmart.co',
  'domain_contains',
  'streamable-http',
  'https://synchroteam-mcp.gensmart.co/mcp',
  '[
    {
      "key": "X-MCP-API-Key",
      "value_ref": "platform_setting:synchroteam_mcp_api_key",
      "description": "Master API key shared between GenSmart and the Synchroteam MCP server (validates the platform itself)."
    }
  ]'::jsonb,
  '[
    {
      "key": "X-Synchroteam-Domain",
      "label_en": "Synchroteam Domain",
      "label_es": "Dominio de Synchroteam",
      "help_text_en": "Your account subdomain in Synchroteam. If your URL is https://acme.synchroteam.com, the domain is ''acme''.",
      "help_text_es": "El subdominio de tu cuenta en Synchroteam. Si tu URL es https://acme.synchroteam.com, el dominio es ''acme''.",
      "required": true,
      "min_length": 3
    },
    {
      "key": "X-Synchroteam-ApiKey",
      "label_en": "Synchroteam API Key",
      "label_es": "API Key de Synchroteam",
      "help_text_en": "Find this in Synchroteam > Configuration > Authentication Key.",
      "help_text_es": "Encuéntrala en Synchroteam > Configuración > Clave de Autenticación.",
      "required": true,
      "min_length": 32
    },
    {
      "key": "X-Synchroteam-Timezone",
      "label_en": "Timezone (IANA)",
      "label_es": "Zona horaria (IANA)",
      "help_text_en": "IANA timezone of the client''s service area. Examples: America/New_York, America/Los_Angeles, America/Bogota.",
      "help_text_es": "Zona horaria IANA del área de servicio del cliente. Ejemplos: America/New_York, America/Los_Angeles, America/Bogota.",
      "required": true,
      "min_length": 5
    },
    {
      "key": "X-Synchroteam-WorkHours",
      "label_en": "Work Hours (DSL)",
      "label_es": "Horario laboral (DSL)",
      "help_text_en": "Working hours per day. Format: ''mon-fri=08:00-20:00;sat=09:00-14:00;sun=closed''. Use ''closed'' for non-working days.",
      "help_text_es": "Horario laboral por día. Formato: ''mon-fri=08:00-20:00;sat=09:00-14:00;sun=closed''. Usa ''closed'' para días no laborables.",
      "required": true,
      "min_length": 10
    },
    {
      "key": "X-Synchroteam-Windows",
      "label_en": "Scheduling Windows (DSL)",
      "label_es": "Ventanas de agendamiento (DSL)",
      "help_text_en": "Service windows within the work day. Format: ''Morning=08:00-12:00;Afternoon=13:00-17:00;Evening=17:00-20:00''.",
      "help_text_es": "Ventanas de servicio dentro del día laboral. Formato: ''Morning=08:00-12:00;Afternoon=13:00-17:00;Evening=17:00-20:00''.",
      "required": true,
      "min_length": 10
    },
    {
      "key": "X-Synchroteam-TechnicianId",
      "label_en": "Technician ID (optional)",
      "label_es": "ID del técnico (opcional)",
      "help_text_en": "Numeric ID of the default technician used for scheduling. If empty, the MCP auto-resolves the first active technician via /user/list.",
      "help_text_es": "ID numérico del técnico predeterminado usado para agendamiento. Si se deja vacío, el MCP autorresuelve el primer técnico activo vía /user/list.",
      "required": false,
      "min_length": 1
    }
  ]'::jsonb,
  '[]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO platform_settings (key, value, is_encrypted, description) VALUES
  ('synchroteam_mcp_api_key', '', true, 'Master API key for connecting to Synchroteam MCP. Configured by Genner as MCP admin.')
ON CONFLICT (key) DO NOTHING;

-- Down Migration
DELETE FROM platform_settings WHERE key = 'synchroteam_mcp_api_key';
DELETE FROM mcp_provider_profiles WHERE id = 'synchroteam';
