/**
 * Búsqueda e interpolación de las traducciones del sitio, sin diccionarios: sirve
 * en el cliente (`useSiteTranslation`, con el del contexto) y en el servidor (`siteT`).
 * Si la clave no existe devuelve la clave (`scripts/check-i18n-keys.mjs` evita que pase).
 */
export type SiteT = (key: string, values?: Record<string, string | number>) => string;

function lookup(dict: unknown, key: string): string | undefined {
  let current: unknown = dict;
  for (const part of key.split('.')) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === 'string' ? current : undefined;
}

export function makeSiteT(dict: unknown): SiteT {
  return (key, values) => {
    const template = lookup(dict, key) ?? key;
    if (!values) return template;
    return template.replace(/\{(\w+)\}/g, (match, name: string) => {
      const value = values[name];
      return value === undefined ? match : String(value);
    });
  };
}
