/**
 * Registro de las páginas del sitio público con rutas por idioma.
 * Español vive en la raíz (`/`, `/precios`) e inglés bajo `/en` (`/en`, `/en/pricing`).
 * Internamente todas se sirven desde `app/(site)/[lang]/…`: `proxy.ts` reescribe
 * las rutas públicas en español a `/es{interna}`.
 */
import type { SupportedLanguage } from '@/contexts/LanguageContext';
import type { DocId } from '@gensmart/shared';
import { DOC_ROUTES, docRouteId, type DocRouteId } from './docs-routes';

export const SITE_LANGUAGES = ['es', 'en'] as const satisfies readonly SupportedLanguage[];
export type SiteLanguage = (typeof SITE_LANGUAGES)[number];

/** Idioma de `x-default` (mercado principal). */
export const DEFAULT_SITE_LANGUAGE: SiteLanguage = 'es';

export const SITE_ORIGIN = 'https://www.gensmart.co';

export type SiteRouteId =
  | 'home'
  | 'pricing'
  | 'product'
  | 'productAgents'
  | 'productInbox'
  | 'productCrm'
  | 'productBooking'
  | 'integrations'
  | 'contact'
  | 'teamSales'
  | 'teamCustomerSupport'
  | 'teamMarketing'
  | 'teamOperationsBooking'
  | 'teamHumanResources'
  | 'teamCollections'
  | 'solutions'
  | 'ecommerce'
  | 'cases'
  | 'industryEcommerce'
  | 'industryClinics'
  | 'industryRealEstate'
  | 'industryFieldServices'
  | 'industryEducation'
  | 'industryRestaurants'
  | 'industryAutomotive'
  | 'industryBeautyWellness'
  | 'industryFinanceInsurance'
  | 'industryTravel'
  | 'industryProfessionalServices'
  | 'industryB2b'
  | 'partners'
  | 'partnersDirectory'
  | 'resources'
  | 'community'
  | 'docs'
  | DocRouteId;

export interface SiteRoute {
  id: SiteRouteId;
  /** Ruta bajo `[lang]`, sin el idioma. El home es `''`. */
  internal: string;
  /** Ruta pública por idioma. */
  paths: Record<SiteLanguage, string>;
}

/**
 * Base de conocimiento: el índice y una página por guía (`/docs/[doc]`). La ruta interna usa
 * el slug en inglés; `proxy.ts` reescribe `/docs/<slug-es>` a `/es/docs/<slug-en>`.
 */
const DOC_PAGES = Object.fromEntries(
  DOC_ROUTES.map((d) => {
    const id = docRouteId(d.id);
    const route: SiteRoute = {
      id,
      internal: `/docs/${d.slug.en}`,
      paths: { es: `/docs/${d.slug.es}`, en: `/en/docs/${d.slug.en}` },
    };
    return [id, route];
  })
) as Record<DocRouteId, SiteRoute>;

export const SITE_ROUTES: Record<SiteRouteId, SiteRoute> = {
  home: { id: 'home', internal: '', paths: { es: '/', en: '/en' } },
  pricing: { id: 'pricing', internal: '/pricing', paths: { es: '/precios', en: '/en/pricing' } },
  product: { id: 'product', internal: '/product', paths: { es: '/producto', en: '/en/product' } },
  integrations: {
    id: 'integrations',
    internal: '/integrations',
    paths: { es: '/integraciones', en: '/en/integrations' },
  },
  contact: { id: 'contact', internal: '/contact', paths: { es: '/contacto', en: '/en/contact' } },
  // Subpáginas de Producto: rutas jerárquicas (mejores migas y SEO)
  productAgents: {
    id: 'productAgents',
    internal: '/product/agents',
    paths: { es: '/producto/agentes', en: '/en/product/ai-agents' },
  },
  productInbox: {
    id: 'productInbox',
    internal: '/product/inbox',
    paths: { es: '/producto/bandeja', en: '/en/product/inbox' },
  },
  productCrm: {
    id: 'productCrm',
    internal: '/product/crm',
    paths: { es: '/producto/crm', en: '/en/product/crm' },
  },
  productBooking: {
    id: 'productBooking',
    internal: '/product/scheduling',
    paths: { es: '/producto/agenda', en: '/en/product/scheduling' },
  },
  // Soluciones por equipo: /soluciones/equipos/… y /en/solutions/teams/…
  teamSales: {
    id: 'teamSales',
    internal: '/solutions/teams/sales',
    paths: { es: '/soluciones/equipos/ventas', en: '/en/solutions/teams/sales' },
  },
  teamCustomerSupport: {
    id: 'teamCustomerSupport',
    internal: '/solutions/teams/customer-support',
    paths: { es: '/soluciones/equipos/atencion-al-cliente', en: '/en/solutions/teams/customer-support' },
  },
  teamMarketing: {
    id: 'teamMarketing',
    internal: '/solutions/teams/marketing',
    paths: { es: '/soluciones/equipos/marketing', en: '/en/solutions/teams/marketing' },
  },
  teamOperationsBooking: {
    id: 'teamOperationsBooking',
    internal: '/solutions/teams/operations-and-bookings',
    paths: { es: '/soluciones/equipos/operaciones-y-reservas', en: '/en/solutions/teams/operations-and-bookings' },
  },
  teamHumanResources: {
    id: 'teamHumanResources',
    internal: '/solutions/teams/human-resources',
    paths: { es: '/soluciones/equipos/recursos-humanos', en: '/en/solutions/teams/human-resources' },
  },
  teamCollections: {
    id: 'teamCollections',
    internal: '/solutions/teams/collections',
    paths: { es: '/soluciones/equipos/cobranzas', en: '/en/solutions/teams/collections' },
  },
  // Índice de Soluciones: industrias y equipos (/soluciones/equipos e /industrias redirigen aquí)
  solutions: { id: 'solutions', internal: '/solutions', paths: { es: '/soluciones', en: '/en/solutions' } },
  // Landing E-commerce (agente comercial para tiendas online); la industria va aparte
  ecommerce: { id: 'ecommerce', internal: '/solutions/ecommerce', paths: { es: '/soluciones/ecommerce', en: '/en/solutions/ecommerce' } },
  // Casos de uso: los 6 trabajos del agente
  cases: { id: 'cases', internal: '/solutions/use-cases', paths: { es: '/soluciones/casos-de-uso', en: '/en/solutions/use-cases' } },
  // Soluciones por industria: /soluciones/industrias/… y /en/solutions/industries/…
  industryEcommerce: {
    id: 'industryEcommerce',
    internal: '/solutions/industries/ecommerce',
    paths: { es: '/soluciones/industrias/ecommerce', en: '/en/solutions/industries/ecommerce' },
  },
  industryClinics: {
    id: 'industryClinics',
    internal: '/solutions/industries/clinics',
    paths: { es: '/soluciones/industrias/clinicas', en: '/en/solutions/industries/clinics' },
  },
  industryRealEstate: {
    id: 'industryRealEstate',
    internal: '/solutions/industries/real-estate',
    paths: { es: '/soluciones/industrias/inmobiliarias', en: '/en/solutions/industries/real-estate' },
  },
  industryFieldServices: {
    id: 'industryFieldServices',
    internal: '/solutions/industries/field-services',
    paths: { es: '/soluciones/industrias/servicios-en-campo', en: '/en/solutions/industries/field-services' },
  },
  industryEducation: {
    id: 'industryEducation',
    internal: '/solutions/industries/education',
    paths: { es: '/soluciones/industrias/educacion', en: '/en/solutions/industries/education' },
  },
  industryRestaurants: {
    id: 'industryRestaurants',
    internal: '/solutions/industries/restaurants',
    paths: { es: '/soluciones/industrias/restaurantes', en: '/en/solutions/industries/restaurants' },
  },
  industryAutomotive: {
    id: 'industryAutomotive',
    internal: '/solutions/industries/automotive',
    paths: { es: '/soluciones/industrias/automotriz', en: '/en/solutions/industries/automotive' },
  },
  industryBeautyWellness: {
    id: 'industryBeautyWellness',
    internal: '/solutions/industries/beauty-and-wellness',
    paths: { es: '/soluciones/industrias/belleza-y-bienestar', en: '/en/solutions/industries/beauty-and-wellness' },
  },
  industryFinanceInsurance: {
    id: 'industryFinanceInsurance',
    internal: '/solutions/industries/finance-and-insurance',
    paths: { es: '/soluciones/industrias/finanzas-y-seguros', en: '/en/solutions/industries/finance-and-insurance' },
  },
  industryTravel: {
    id: 'industryTravel',
    internal: '/solutions/industries/travel-and-tourism',
    paths: { es: '/soluciones/industrias/turismo-y-viajes', en: '/en/solutions/industries/travel-and-tourism' },
  },
  industryProfessionalServices: {
    id: 'industryProfessionalServices',
    internal: '/solutions/industries/professional-services',
    paths: { es: '/soluciones/industrias/servicios-profesionales', en: '/en/solutions/industries/professional-services' },
  },
  industryB2b: {
    id: 'industryB2b',
    internal: '/solutions/industries/b2b-and-saas',
    paths: { es: '/soluciones/industrias/b2b-y-saas', en: '/en/solutions/industries/b2b-and-saas' },
  },
  // Partners: programa de socios y directorio (/referidos y /en/referrals redirigen aquí)
  partners: { id: 'partners', internal: '/partners', paths: { es: '/partners', en: '/en/partners' } },
  partnersDirectory: {
    id: 'partnersDirectory',
    internal: '/partners/directory',
    paths: { es: '/partners/directorio', en: '/en/partners/directory' },
  },
  // Recursos: el centro y Comunidad, anidada como en las migas (Inicio / Recursos / Comunidad)
  resources: { id: 'resources', internal: '/resources', paths: { es: '/recursos', en: '/en/resources' } },
  community: {
    id: 'community',
    internal: '/resources/community',
    paths: { es: '/recursos/comunidad', en: '/en/resources/community' },
  },
  // Base de conocimiento (centro de ayuda). /docs/whatsapp-setup redirige a la guía de WhatsApp
  docs: { id: 'docs', internal: '/docs', paths: { es: '/docs', en: '/en/docs' } },
  ...DOC_PAGES,
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

/** Página de contacto en el idioma del usuario (componentes viejos y enlaces fuera de `SiteLink`). */
export function contactHref(language: SupportedLanguage): string {
  return publicPath('contact', isSiteLanguage(language) ? language : DEFAULT_SITE_LANGUAGE);
}

/** Guía de la base de conocimiento en el idioma del usuario (dashboard y componentes viejos). */
export function docGuideHref(id: DocId, language: SupportedLanguage): string {
  return publicPath(docRouteId(id), isSiteLanguage(language) ? language : DEFAULT_SITE_LANGUAGE);
}

/** Índice de la base de conocimiento en el idioma del usuario. */
export function docsHref(language: SupportedLanguage): string {
  return publicPath('docs', isSiteLanguage(language) ? language : DEFAULT_SITE_LANGUAGE);
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

/** `/{idioma}{interna}` (la ruta reescrita por `proxy.ts`) como página de ese idioma. */
function matchRewritten(pathname: string): { route: SiteRoute; lang: SiteLanguage } | null {
  const path = normalize(pathname);
  for (const lang of SITE_LANGUAGES) {
    const prefix = `/${lang}`;
    if (path !== prefix && !path.startsWith(`${prefix}/`)) continue;
    const route = matchInternalPath(path.slice(prefix.length));
    if (route) return { route, lang };
  }
  return null;
}

/** La misma página en el otro idioma, o `null` si la ruta no está en el registro. */
export function counterpart(pathname: string): { lang: SiteLanguage; path: string } | null {
  const match = matchPublicPath(pathname) ?? matchRewritten(pathname);
  if (!match) return null;
  const lang = otherLanguage(match.lang);
  return { lang, path: match.route.paths[lang] };
}
