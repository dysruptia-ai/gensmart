export declare const CONFIG_VARIABLE_TYPES: readonly ["string", "textarea", "number", "boolean", "url", "enum"];
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
    visible_when?: {
        key: string;
        equals: unknown;
    } | null;
    help_slug?: string;
}
export type ConfigVariableValues = Record<string, string | number | boolean | null>;
export declare const CONFIG_VARIABLE_KEY_PATTERN: RegExp;
export declare const CONFIG_VARIABLE_KEY_MAX_LENGTH = 64;
export declare const isValidConfigVariableKey: (key: string) => boolean;
/**
 * Validate a single variable's schema entry. Returns null if valid, or an
 * i18n error key. Does not validate `visible_when` or `help_slug` (RESERVED).
 */
export declare function validateConfigVariableSchema(entry: unknown): string | null;
/**
 * Validate a value against its schema entry. Returns null when valid, or an
 * i18n error key. Coerces stringy numbers ("123") to numbers for the `number`
 * type so HTML inputs work end-to-end.
 */
export declare function validateConfigVariableValue(schema: ConfigVariableSchema, value: unknown): string | null;
/**
 * Merge a template's schema with an agent's overrides. An override with the
 * same key as a template entry REPLACES it. New keys are appended. Output is
 * sorted by `order` ascending; entries without `order` go last (stable).
 */
export declare function mergeConfigVariablesSchema(templateSchema: ConfigVariableSchema[], overrides: ConfigVariableSchema[]): ConfigVariableSchema[];
/**
 * Render config variables into a system prompt by replacing {{config.<key>}}.
 * Rules:
 *   - Key present in schema + has value → String(value)
 *   - Key present in schema + empty value + has default → String(default)
 *   - Key present in schema + empty value + no default → '' (safe for prod)
 *   - Key NOT in schema → leave placeholder verbatim (likely typo / stale ref)
 */
export declare function injectConfigVariables(systemPrompt: string, schema: ConfigVariableSchema[], values: ConfigVariableValues): string;
/**
 * List required keys with empty/null values. Used by the publish endpoint to
 * block publishing with a 400 + missing_keys list.
 */
export declare function findMissingRequiredConfigVariables(schema: ConfigVariableSchema[], values: ConfigVariableValues): string[];
/**
 * Deep-traverse any object/array/string and replace {{config.<key>}} placeholders.
 * Used for Custom Function tool configs (URL, headers, bodyTemplate) and any
 * other place customers store secrets or shared values via config variables
 * outside the system prompt. Mirrors injectConfigVariables semantics:
 * leaves placeholder verbatim if key not in schema.
 */
export declare function injectConfigVariablesDeep<T>(obj: T, schema: ConfigVariableSchema[], values: ConfigVariableValues): T;
/**
 * Initialize a values object from a schema, applying `default` where set.
 * Useful when creating an agent from a template so the UI shows pre-filled
 * defaults the customer can keep or change.
 */
export declare function initialConfigVariableValues(schema: ConfigVariableSchema[]): ConfigVariableValues;
//# sourceMappingURL=config-variables.d.ts.map