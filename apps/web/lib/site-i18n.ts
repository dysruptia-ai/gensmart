/**
 * Traducción del sitio público fuera de un hook, solo en el servidor (metadatos, JSON-LD,
 * páginas de servidor). Carga los dos idiomas de `i18n/site/*`, por eso `server-only`: en el
 * cliente se usa `useSiteTranslation`, que lee el diccionario de un solo idioma del contexto.
 */
import 'server-only';
import en from '@/i18n/site/en.json';
import es from '@/i18n/site/es.json';
import { makeSiteT, type SiteT } from './site-t';
import type { SiteLanguage } from './site-routes';

export type { SiteT };

const TRANSLATORS: Record<SiteLanguage, SiteT> = { en: makeSiteT(en), es: makeSiteT(es) };

export function siteT(lang: SiteLanguage): SiteT {
  return TRANSLATORS[lang];
}
