/**
 * Búsqueda de claves, plurales e interpolación de los diccionarios de la plataforma (`i18n/app/*`).
 * Es puro para poder probarlo; `useTranslation` lo usa con el idioma actual.
 *
 * Plurales (web-44): si se pasa `count` y existen `key_one` / `key_other` (o la categoría que dé
 * `Intl.PluralRules`), se elige con `Intl.PluralRules(language)`; una categoría que falta cae en
 * `key_other`. Si no hay variantes, se usa `key` como siempre.
 */
export type InterpolationValues = Record<string, string | number>;

/** Navega un objeto anidado con una clave con puntos: 'dashboard.stats.title'. */
export function getNestedValue(obj: Record<string, unknown>, key: string): string | undefined {
  const parts = key.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === 'string' ? current : undefined;
}

/** Cambia {variable} por su valor: interpolate('Hola, {name}!', { name: 'Juan' }) → 'Hola, Juan!'. */
export function interpolate(template: string, values?: InterpolationValues): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const val = values[key];
    return val !== undefined ? String(val) : `{${key}}`;
  });
}

const rulesCache = new Map<string, Intl.PluralRules>();
function pluralCategory(language: string, count: number): Intl.LDMLPluralRule {
  let rules = rulesCache.get(language);
  if (!rules) {
    rules = new Intl.PluralRules(language);
    rulesCache.set(language, rules);
  }
  return rules.select(count);
}

/** El texto de una clave en un diccionario (con plural si hay `count` y variantes), o undefined. */
export function lookup(dict: Record<string, unknown>, language: string, key: string, values?: InterpolationValues): string | undefined {
  const count = values?.['count'];
  if (typeof count === 'number' && Number.isFinite(count)) {
    const variant =
      getNestedValue(dict, `${key}_${pluralCategory(language, count)}`) ?? getNestedValue(dict, `${key}_other`);
    if (variant !== undefined) return variant;
  }
  return getNestedValue(dict, key);
}

/** Idioma actual, después inglés, después la clave misma; con los valores ya puestos. */
export function translate(
  dicts: { current: Record<string, unknown>; fallback: Record<string, unknown> },
  language: string,
  key: string,
  values?: InterpolationValues,
): string {
  const value = lookup(dicts.current, language, key, values) ?? lookup(dicts.fallback, 'en', key, values) ?? key;
  return interpolate(value, values);
}
