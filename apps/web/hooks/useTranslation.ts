import { useCallback } from 'react';
import { useLanguage, type SupportedLanguage } from '@/contexts/LanguageContext';
import en from '@/i18n/app/en.json';
import es from '@/i18n/app/es.json';
import { translate } from '@/lib/translate';

type Translations = typeof en;
type InterpolationValues = Record<string, string | number>;

const dictionaries: Record<SupportedLanguage, Translations> = { en, es };

interface UseTranslationReturn {
  t: (key: string, values?: InterpolationValues) => string;
  language: SupportedLanguage;
}

/**
 * Hook to access the platform translations (dashboard, auth, admin, widget).
 * The public site uses `useSiteTranslation` (`i18n/site/*`).
 *
 * @example
 * const { t } = useTranslation();
 * t('common.save')                      → 'Save' / 'Guardar'
 * t('dashboard.stats.today', { count: 5 }) → 'Today: 5' / 'Hoy: 5'
 * t('inbox.labels.more', { count: 1 })    → '1 more label' (inbox.labels.more_one / _other)
 */
export function useTranslation(): UseTranslationReturn {
  const { language } = useLanguage();

  const t = useCallback(
    (key: string, values?: InterpolationValues): string => {
      // Current language first, then English, then the key itself. With { count } and key_one/key_other,
      // the plural form is chosen with Intl.PluralRules (lib/translate.ts).
      return translate(
        { current: dictionaries[language] as Record<string, unknown>, fallback: dictionaries['en'] as Record<string, unknown> },
        language,
        key,
        values,
      );
    },
    [language]
  );

  return { t, language };
}
