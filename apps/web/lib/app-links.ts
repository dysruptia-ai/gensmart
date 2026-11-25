import type { SupportedLanguage } from '@/contexts/LanguageContext';

/**
 * Enlaces de la plataforma hacia el sitio público, por idioma.
 * El sitio vive en español en la raíz y en inglés bajo `/en` (ver lib/site-routes.ts).
 * Se escriben aquí para que la plataforma no dependa de los módulos del sitio.
 */
export const APP_SITE_LINKS = {
  home: { es: '/', en: '/en' },
  terms: { es: '/legal/terminos-del-servicio', en: '/en/legal/terms-of-service' },
  privacy: { es: '/legal/politica-de-privacidad', en: '/en/legal/privacy-policy' },
  help: { es: '/docs', en: '/en/docs' },
} as const satisfies Record<string, Record<SupportedLanguage, string>>;

export type AppSiteLink = keyof typeof APP_SITE_LINKS;

export function appSiteHref(link: AppSiteLink, language: SupportedLanguage): string {
  return APP_SITE_LINKS[link][language];
}

export const SUPPORT_EMAIL = 'hello@gensmart.co';
