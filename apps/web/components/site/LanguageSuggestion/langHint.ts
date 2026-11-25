/**
 * Textos de `LanguageSuggestion`. Van en el idioma sugerido (el otro), así que no viven
 * en `i18n/site/*`: cada página carga solo el diccionario de su idioma.
 */
import type { SiteLanguage } from '@/lib/site-routes';

export interface LangHint {
  region: string;
  text: string;
  link: string;
  dismiss: string;
}

export const LANG_HINTS: Record<SiteLanguage, LangHint> = {
  es: {
    region: 'Sugerencia de idioma',
    text: 'Esta página también está en español.',
    link: 'Ver en español',
    dismiss: 'Cerrar la sugerencia de idioma',
  },
  en: {
    region: 'Language suggestion',
    text: 'This page is also available in English.',
    link: 'View in English',
    dismiss: 'Dismiss language suggestion',
  },
};
