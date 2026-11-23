/**
 * Registro de las páginas del sitio público con rutas por idioma.
 * Español vive en la raíz (`/`, `/precios`) e inglés bajo `/en` (`/en`, `/en/pricing`).
 * Internamente todas se sirven desde `app/(site)/[lang]/…`: `proxy.ts` reescribe
 * las rutas públicas en español a `/es{interna}`.
 */
import type { SupportedLanguage } from '@/contexts/LanguageContext';

export const SITE_LANGUAGES = ['es', 'en'] as const satisfies readonly SupportedLanguage[];
export type SiteLanguage = (typeof SITE_LANGUAGES)[number];

/** Idioma de `x-default` (mercado principal). */
export const DEFAULT_SITE_LANGUAGE: SiteLanguage = 'es';

export const SITE_ORIGIN = 'https://www.gensmart.co';

export type SiteRouteId = 'home' | 'pricing';

export interface SiteRoute {
  id: SiteRouteId;
  /** Ruta bajo `[lang]`, sin el idioma. El home es `''`. */
  internal: string;
  /** Ruta pública por idioma. */
  paths: Record<SiteLanguage, string>;
}

export const SITE_ROUTES: Record<SiteRouteId, SiteRoute> = {
  home: { id: 'home', internal: '', paths: { es: '/', en: '/en' } },
  pricing: { id: 'pricing', internal: '/pricing', paths: { es: '/precios', en: '/en/pricing' } },
};

const ROUTE_LIST: SiteRoute[] = Object.values(SITE_ROUTES);

export function isSiteLanguage(value: string): value is SiteLanguage {
  return (SITE_LANGUAGES as readonly string[]).includes(value);
}

export function otherLanguage(lang: SiteLanguage): SiteLanguage {
  return lang === 'es' ? 'en' : 'es';
}

export function publicPath(id: SiteRouteId, lang: SiteLanguage): string {
  return SITE_ROUTES[id].paths[lang];
}

/**
 * Página de precios en el idioma del usuario. Para el dashboard, los componentes viejos
 * y cualquier enlace fuera de `SiteLink`: así nadie escribe `/precios` o `/en/pricing` a mano.
 */
export function pricingHref(language: SupportedLanguage): string {
  return publicPath('pricing', isSiteLanguage(language) ? language : DEFAULT_SITE_LANGUAGE);
}

export function absoluteUrl(path: string): string {
  return path === '/' ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${path}`;
}

/** URLs absolutas por idioma + `x-default`, para `alternates` de metadatos y sitemap. */
export function alternates(id: SiteRouteId): Record<SiteLanguage | 'x-default', string> {
  const { paths } = SITE_ROUTES[id];
  return {
    es: absoluteUrl(paths.es),
    en: absoluteUrl(paths.en),
    'x-default': absoluteUrl(paths[DEFAULT_SITE_LANGUAGE]),
  };
}

function normalize(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

/** Página del registro cuya ruta pública coincide, con su idioma. */
export function matchPublicPath(pathname: string): { route: SiteRoute; lang: SiteLanguage } | null {
  const path = normalize(pathname);
  for (const route of ROUTE_LIST) {
    for (const lang of SITE_LANGUAGES) {
      if (route.paths[lang] === path) return { route, lang };
    }
  }
  return null;
}

/** Página del registro por su ruta interna (sin idioma). */
export function matchInternalPath(internal: string): SiteRoute | null {
  const path = normalize(internal) === '/' ? '' : normalize(internal);
  return ROUTE_LIST.find((route) => route.internal === path) ?? null;
}

/** `/es{interna}` (la ruta reescrita por `proxy.ts`) como página en español. */
function matchRewrittenEs(pathname: string): { route: SiteRoute; lang: SiteLanguage } | null {
  const path = normalize(pathname);
  if (path !== '/es' && !path.startsWith('/es/')) return null;
  const route = matchInternalPath(path.slice(3));
  return route ? { route, lang: 'es' } : null;
}

/** La misma página en el otro idioma, o `null` si la ruta no está en el registro. */
export function counterpart(pathname: string): { lang: SiteLanguage; path: string } | null {
  const match = matchPublicPath(pathname) ?? matchRewrittenEs(pathname);
  if (!match) return null;
  const lang = otherLanguage(match.lang);
  return { lang, path: match.route.paths[lang] };
}
