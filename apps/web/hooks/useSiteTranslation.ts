import { useMemo } from 'react';
import { useLanguage, type SupportedLanguage } from '@/contexts/LanguageContext';
import { siteT, type SiteT } from '@/lib/site-i18n';

interface UseSiteTranslationReturn {
  t: SiteT;
  language: SupportedLanguage;
}

/**
 * Traducciones del sitio público (`i18n/site/*`). Misma firma y misma búsqueda que
 * `useTranslation` de la plataforma: idioma pedido, luego inglés, luego la clave.
 */
export function useSiteTranslation(): UseSiteTranslationReturn {
  const { language } = useLanguage();
  const t = useMemo(() => siteT(language), [language]);
  return { t, language };
}
