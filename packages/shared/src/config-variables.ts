// Agent Config Variables — Day 21
// Decouples WHAT the agent says (system prompt) from WHAT the customer
// configures (product name, store URL, voice tone). The contract lives in
// `agent_templates.config_variables_schema`; values live per-agent in
// `agents.config_variables_values`. Power users can extend the schema via
// `agents.config_variables_schema_overrides`.

export const CONFIG_VARIABLE_TYPES = [
  'string',
  'textarea',
  'number',
  'boolean',
  'url',
  'enum',
] as const;
export type ConfigVariableType = typeof CONFIG_VARIABLE_TYPES[number];

export interface ConfigVariableOption {
  value: string;
  label_en: string;
  label_es: string;
}

export interface ConfigVariableSchema {
  key: string;
  type: ConfigVariableType;
  label_en: string;
  label_es: string;
  description_en?: string;
  description_es?: string;
  required: boolean;
  default?: string | number | boolean | null;
  placeholder_en?: string;
  placeholder_es?: string;
  group?: string;
  order?: number;
  options?: ConfigVariableOption[];
  min?: number;
  max?: number;
  visible_when?: { key: string; equals: unknown } | null;
  // RESERVED for post-Day 33 help system. Will resolve to /help/{help_slug}.
  // Do NOT render, validate or include in editors yet.
  help_slug?: string;
}

export type ConfigVariableValues = Record<string, string | number | boolean | null>;

export const CONFIG_VARIABLE_KEY_PATTERN = /^[a-z][a-z0-9_]*$/;
export const CONFIG_VARIABLE_KEY_MAX_LENGTH = 64;

export const isValidConfigVariableKey = (key: string): boolean =>
  typeof key === 'string' &&
  key.length > 0 &&
  key.length <= CONFIG_VARIABLE_KEY_MAX_LENGTH &&
  CONFIG_VARIABLE_KEY_PATTERN.test(key);

/**
 * Validate a single variable's schema entry. Returns null if valid, or an
 * i18n error key. Does not validate `visible_when` or `help_slug` (RESERVED).
 */
export function validateConfigVariableSchema(entry: unknown): string | null {
  if (!entry || typeof entry !== 'object') return 'errors.configVariables.invalidSchema';
  const s = entry as Partial<ConfigVariableSchema>;
  if (!s.key || !isValidConfigVariableKey(s.key)) {
    return s.key && s.key.length > CONFIG_VARIABLE_KEY_MAX_LENGTH
      ? 'errors.configVariables.keyTooLong'
      : 'errors.configVariables.invalidKey';
  }
  if (!s.type || !CONFIG_VARIABLE_TYPES.includes(s.type as ConfigVariableType)) {
    return 'errors.configVariables.unknownType';
  }
  if (typeof s.label_en !== 'string' || s.label_en.length === 0) {
    return 'errors.configVariables.invalidLabel';
  }
  if (typeof s.label_es !== 'string' || s.label_es.length === 0) {
    return 'errors.configVariables.invalidLabel';
  }
  if (typeof s.required !== 'boolean') return 'errors.configVariables.invalidRequired';
  if (s.type === 'enum') {
    if (!Array.isArray(s.options) || s.options.length === 0) {
      return 'errors.configVariables.noOptions';
    }
    for (const opt of s.options) {
      if (
        !opt ||
        typeof opt.value !== 'string' ||
        typeof opt.label_en !== 'string' ||
        typeof opt.label_es !== 'string'
      ) {
        return 'errors.configVariables.invalidOption';
      }
    }
  }
  return null;
}

/**
 * Validate a value against its schema entry. Returns null when valid, or an
 * i18n error key. Coerces stringy numbers ("123") to numbers for the `number`
 * type so HTML inputs work end-to-end.
 */
export function validateConfigVariableValue(
  schema: ConfigVariableSchema,
  value: unknown
): string | null {
  const isEmpty = value === null || value === undefined || value === '';
  if (schema.required && isEmpty) return 'errors.configVariables.required';
  if (isEmpty) return null;

  switch (schema.type) {
    case 'string':
    case 'textarea': {
      if (typeof value !== 'string') return 'errors.configVariables.invalidType';
      if (schema.min !== undefined && value.length < schema.min) {
        return 'errors.configVariables.tooShort';
      }
      if (schema.max !== undefined && value.length > schema.max) {
        return 'errors.configVariables.tooLong';
      }
      return null;
    }
    case 'number': {
      const num = typeof value === 'string' ? Number(value) : value;
      if (typeof num !== 'number' || Number.isNaN(num)) {
        return 'errors.configVariables.invalidNumber';
      }
      if (schema.min !== undefined && num < schema.min) return 'errors.configVariables.belowMin';
      if (schema.max !== undefined && num > schema.max) return 'errors.configVariables.aboveMax';
      return null;
    }
    case 'boolean':
      if (typeof value !== 'boolean') return 'errors.configVariables.invalidType';
      return null;
    case 'url': {
      if (typeof value !== 'string') return 'errors.configVariables.invalidType';
      try {
        const u = new URL(value);
        if (!['http:', 'https:'].includes(u.protocol)) {
          return 'errors.configVariables.invalidUrl';
        }
        return null;
      } catch {
        return 'errors.configVariables.invalidUrl';
      }
    }
    case 'enum':
      if (!schema.options || schema.options.length === 0) return 'errors.configVariables.noOptions';
      if (!schema.options.some((o) => o.value === value)) {
        return 'errors.configVariables.invalidEnum';
      }
      return null;
    default:
      return 'errors.configVariables.unknownType';
  }
}

/**
 * Merge a template's schema with an agent's overrides. An override with the
 * same key as a template entry REPLACES it. New keys are appended. Output is
 * sorted by `order` ascending; entries without `order` go last (stable).
 */
export function mergeConfigVariablesSchema(
  templateSchema: ConfigVariableSchema[],
  overrides: ConfigVariableSchema[]
): ConfigVariableSchema[] {
  const merged = new Map<string, ConfigVariableSchema>();
  for (const v of templateSchema ?? []) merged.set(v.key, v);
  for (const v of overrides ?? []) merged.set(v.key, v);
  return Array.from(merged.values()).sort((a, b) => {
    const aOrder = a.order ?? Number.MAX_SAFE_INTEGER;
    const bOrder = b.order ?? Number.MAX_SAFE_INTEGER;
    return aOrder - bOrder;
  });
}

/**
 * Render config variables into a system prompt by replacing {{config.<key>}}.
 * Rules:
 *   - Key present in schema + has value → String(value)
 *   - Key present in schema + empty value + has default → String(default)
 *   - Key present in schema + empty value + no default → '' (safe for prod)
 *   - Key NOT in schema → leave placeholder verbatim (likely typo / stale ref)
 */
export function injectConfigVariables(
  systemPrompt: string,
  schema: ConfigVariableSchema[],
  values: ConfigVariableValues
): string {
  if (!systemPrompt) return systemPrompt;
  const schemaByKey = new Map((schema ?? []).map((s) => [s.key, s]));
  return systemPrompt.replace(/\{\{config\.([a-z][a-z0-9_]*)\}\}/g, (match, key: string) => {
    const variable = schemaByKey.get(key);
    if (!variable) return match;
    const value = (values ?? {})[key];
    if (value === null || value === undefined || value === '') {
      return variable.default !== undefined && variable.default !== null
        ? String(variable.default)
        : '';
    }
    return String(value);
  });
}

/**
 * List required keys with empty/null values. Used by the publish endpoint to
 * block publishing with a 400 + missing_keys list.
 */
export function findMissingRequiredConfigVariables(
  schema: ConfigVariableSchema[],
  values: ConfigVariableValues
): string[] {
  return (schema ?? [])
    .filter((s) => s.required)
    .filter((s) => {
      const v = (values ?? {})[s.key];
      return v === null || v === undefined || v === '';
    })
    .map((s) => s.key);
}

/**
 * Initialize a values object from a schema, applying `default` where set.
 * Useful when creating an agent from a template so the UI shows pre-filled
 * defaults the customer can keep or change.
 */
export function initialConfigVariableValues(
  schema: ConfigVariableSchema[]
): ConfigVariableValues {
  const out: ConfigVariableValues = {};
  for (const s of schema ?? []) {
    if (s.default !== undefined && s.default !== null) {
      out[s.key] = s.default;
    }
  }
  return out;
}
