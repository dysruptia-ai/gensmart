/**
 * Traducción del sitio público fuera de un hook: para metadatos, JSON-LD y datos
 * que se arman igual en el servidor y en el cliente. Misma búsqueda e interpolación
 * que `useTranslation` (idioma pedido, luego inglés, luego la clave).
 */
import en from '@/i18n/en.json';
import es from '@/i18n/es.json';
import type { SiteLanguage } from './site-routes';

export type SiteT = (key: string, values?: Record<string, string | number>) => string;

const DICTIONARIES: Record<SiteLanguage, unknown> = { en, es };

function lookup(dict: unknown, key: string): string | undefined {
  let current: unknown = dict;
  for (const part of key.split('.')) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === 'string' ? current : undefined;
}

export function siteT(lang: SiteLanguage): SiteT {
  return (key, values) => {
    const template = lookup(DICTIONARIES[lang], key) ?? lookup(DICTIONARIES.en, key) ?? key;
    if (!values) return template;
    return template.replace(/\{(\w+)\}/g, (match, name: string) => {
      const value = values[name];
      return value === undefined ? match : String(value);
    });
  };
}
