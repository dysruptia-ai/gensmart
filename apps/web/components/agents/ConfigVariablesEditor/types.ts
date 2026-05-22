// Mirror of the shared ConfigVariableSchema type. We don't import from
// @gensmart/shared here because the frontend pulls in only what it needs and
// keeping a local copy makes the editor easy to evolve without forcing a
// shared rebuild for every UI tweak. Keep this in sync with
// packages/shared/src/config-variables.ts.

export type ConfigVariableType = 'string' | 'textarea' | 'number' | 'boolean' | 'url' | 'enum';

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
  help_slug?: string;
}

export type ConfigVariableValue = string | number | boolean | null;
export type ConfigVariableValues = Record<string, ConfigVariableValue>;

export const CONFIG_VARIABLE_KEY_PATTERN = /^[a-z][a-z0-9_]*$/;
export const CONFIG_VARIABLE_KEY_MAX = 64;

export const isValidKey = (key: string): boolean =>
  key.length > 0 && key.length <= CONFIG_VARIABLE_KEY_MAX && CONFIG_VARIABLE_KEY_PATTERN.test(key);
