import { useCallback } from 'react';
import { useLanguage, type SupportedLanguage } from '@/contexts/LanguageContext';
import en from '@/i18n/en.json';
import es from '@/i18n/es.json';

type Translations = typeof en;
type InterpolationValues = Record<string, string | number>;

const dictionaries: Record<SupportedLanguage, Translations> = { en, es };

/**
 * Navigate a nested object by dot-notation key.
 * e.g. getNestedValue(obj, 'dashboard.stats.title') → string
 */
function getNestedValue(obj: Record<string, unknown>, key: string): string | undefined {
  const parts = key.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === 'string' ? current : undefined;
}

/**
 * Replace {variable} placeholders with provided values.
 * e.g. interpolate('Hello, {name}!', { name: 'Juan' }) → 'Hello, Juan!'
 */
function interpolate(template: string, values?: InterpolationValues): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const val = values[key];
    return val !== undefined ? String(val) : `{${key}}`;
  });
}

interface UseTranslationReturn {
  t: (key: string, values?: InterpolationValues) => string;
  language: SupportedLanguage;
}

/**
 * Hook to access translations.
 *
 * @example
 * const { t } = useTranslation();
 * t('common.save')                      → 'Save' / 'Guardar'
 * t('dashboard.stats.today', { count: 5 }) → 'Today: 5' / 'Hoy: 5'
 */
export function useTranslation(): UseTranslationReturn {
  const { language } = useLanguage();

  const t = useCallback(
    (key: string, values?: InterpolationValues): string => {
      const dict = dictionaries[language] as Record<string, unknown>;
      // Try current language first, fallback to English, then key itself
      const value =
        getNestedValue(dict, key) ??
        getNestedValue(dictionaries['en'] as Record<string, unknown>, key) ??
        key;
      return interpolate(value, values);
    },
    [language]
  );

  return { t, language };
}
