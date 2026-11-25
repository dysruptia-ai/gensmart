import { useContext, useMemo } from 'react';
import { useLanguage, type SupportedLanguage } from '@/contexts/LanguageContext';
import { SiteDictContext } from '@/components/site/SiteDict/SiteDictContext';
import { makeSiteT, type SiteT } from '@/lib/site-t';

interface UseSiteTranslationReturn {
  t: SiteT;
  language: SupportedLanguage;
}

/**
 * Traducciones del sitio público. Lee el diccionario del idioma de la página que puso
 * `SiteDict` en el layout (un solo idioma por página). Si la clave no existe, devuelve la clave.
 */
export function useSiteTranslation(): UseSiteTranslationReturn {
  const { language } = useLanguage();
  const dict = useContext(SiteDictContext);
  const t = useMemo(() => makeSiteT(dict), [dict]);
  return { t, language };
}
