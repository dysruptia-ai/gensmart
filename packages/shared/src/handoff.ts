export interface HandoffContact {
  id: string;
  name: string;
  phone: string;
  /** Calendars that define when this contact is reachable. Empty = always available. */
  calendarIds: string[];
}

export interface HandoffConfig {
  enabled: boolean;
  buttonText: string;
  cooldownMinutes: number;
  labelTtlHours: number;
  contacts: HandoffContact[];
}

export const HANDOFF_BUTTON_TEXT_MAX = 20;
export const HANDOFF_MAX_CONTACTS = 5;

export const DEFAULT_HANDOFF_CONFIG: HandoffConfig = {
  enabled: false,
  buttonText: 'Hablar con el equipo',
  cooldownMinutes: 10,
  labelTtlHours: 24,
  contacts: [],
};

/** Merges a stored (possibly partial or empty) handoff_config with the defaults. */
export function resolveHandoffConfig(raw: unknown): HandoffConfig {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const contacts = Array.isArray(src['contacts'])
    ? (src['contacts'] as unknown[]).filter(
        (c): c is Record<string, unknown> => !!c && typeof c === 'object'
      ).map((c) => ({
        id: String(c['id'] ?? ''),
        name: String(c['name'] ?? ''),
        phone: String(c['phone'] ?? ''),
        calendarIds: Array.isArray(c['calendarIds']) ? (c['calendarIds'] as unknown[]).map(String) : [],
      }))
    : DEFAULT_HANDOFF_CONFIG.contacts;

  return {
    enabled: typeof src['enabled'] === 'boolean' ? src['enabled'] : DEFAULT_HANDOFF_CONFIG.enabled,
    buttonText:
      typeof src['buttonText'] === 'string' && src['buttonText'].length > 0
        ? src['buttonText']
        : DEFAULT_HANDOFF_CONFIG.buttonText,
    cooldownMinutes:
      typeof src['cooldownMinutes'] === 'number' ? src['cooldownMinutes'] : DEFAULT_HANDOFF_CONFIG.cooldownMinutes,
    labelTtlHours:
      typeof src['labelTtlHours'] === 'number' ? src['labelTtlHours'] : DEFAULT_HANDOFF_CONFIG.labelTtlHours,
    contacts,
  };
}
