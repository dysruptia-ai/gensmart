/**
 * Mapa de enlaces del sitio público.
 * `href: null` = página aún no disponible: el enlace se muestra igual pero no navega.
 * Cuando llegue el contenido, solo hay que cambiar el valor aquí.
 */
export type SiteLinkKey =
  | 'home'
  | 'pricing'
  | 'blog'
  | 'contact'
  | 'about'
  | 'login'
  | 'register'
  | 'legalTerms'
  | 'legalPrivacy'
  | 'legalCookies'
  | 'product'
  | 'productAgents'
  | 'productInbox'
  | 'productCrm'
  | 'productBooking'
  | 'integrations'
  | 'industries'
  | 'industryEcommerce'
  | 'industryClinics'
  | 'industryRealEstate'
  | 'industryRestaurants'
  | 'industryEducation'
  | 'industryFinanceInsurance'
  | 'industryFieldServices'
  | 'industryAutomotive'
  | 'industryBeautyWellness'
  | 'industryTravel'
  | 'industryProfessionalServices'
  | 'industryB2b'
  | 'solutions'
  | 'teams'
  | 'teamSales'
  | 'teamCustomerSupport'
  | 'teamMarketing'
  | 'teamOperationsBooking'
  | 'teamHumanResources'
  | 'teamCollections'
  | 'resources'
  | 'docs'
  | 'docsTestAgent'
  | 'docsHandoff'
  | 'academy'
  | 'community'
  | 'partners'
  | 'cases'
  | 'status'
  | 'ecommerce'
  | 'socialInstagram'
  | 'socialTiktok'
  | 'socialYoutube'
  | 'socialFacebook'
  | 'partnersTiers'
  | 'partnersDirectory'
  | 'partnerSignup'
  | DocRouteId
  | AcademyRouteId;

import { ACADEMY_ROUTES, academyRouteId, type AcademyRouteId } from './academy-routes';
import { DOC_ROUTES, docRouteId, type DocRouteId } from './docs-routes';
import { publicPath, type SiteLanguage, type SiteRouteId } from './site-routes';

/** Una clave por guía de la base de conocimiento (`doc-<id>`), con la ruta en inglés de respaldo. */
const DOC_LINKS = Object.fromEntries(
  DOC_ROUTES.map((d) => [docRouteId(d.id), { href: `/en/docs/${d.slug.en}` }])
) as Record<DocRouteId, SiteLinkTarget>;

/** Cursos de Academy (web-31). Con rutas por idioma: se resuelven en LOCALIZED_LINKS. */
const ACADEMY_LINKS = Object.fromEntries(
  ACADEMY_ROUTES.map((c) => [academyRouteId(c.id), { href: `/en/academy/${c.slug.en}` }])
) as Record<AcademyRouteId, SiteLinkTarget>;

export interface SiteLinkTarget {
  href: string | null;
  external?: boolean;
}

export const SITE_LINKS: Record<SiteLinkKey, SiteLinkTarget> = {
  home: { href: '/' },
  // Con rutas por idioma: se resuelve en LOCALIZED_LINKS (`/precios` o `/en/pricing`)
  pricing: { href: '/en/pricing' },
  blog: { href: '/blog' },
  // Con ruta por idioma: se resuelve en LOCALIZED_LINKS (`/contacto` o `/en/contact`)
  contact: { href: '/en/contact' },
  about: { href: '/about' },
  login: { href: '/login' },
  register: { href: '/register' },
  legalTerms: { href: '/legal/terms-of-service' },
  legalPrivacy: { href: '/legal/privacy-policy' },
  legalCookies: { href: '/legal/cookie-policy' },

  // Con rutas por idioma: se resuelven en LOCALIZED_LINKS
  product: { href: '/en/product' },
  productAgents: { href: '/en/product/ai-agents' },
  productInbox: { href: '/en/product/inbox' },
  productCrm: { href: '/en/product/crm' },
  productBooking: { href: '/en/product/scheduling' },
  integrations: { href: '/en/integrations' },

  // Con rutas por idioma: se resuelven en LOCALIZED_LINKS
  solutions: { href: '/en/solutions' },
  industries: { href: '/en/solutions#industries' },
  teams: { href: '/en/solutions#teams' },
  industryEcommerce: { href: '/en/solutions/industries/ecommerce' },
  industryClinics: { href: '/en/solutions/industries/clinics' },
  industryRealEstate: { href: '/en/solutions/industries/real-estate' },
  industryFieldServices: { href: '/en/solutions/industries/field-services' },
  industryEducation: { href: '/en/solutions/industries/education' },
  industryRestaurants: { href: '/en/solutions/industries/restaurants' },
  industryAutomotive: { href: '/en/solutions/industries/automotive' },
  industryBeautyWellness: { href: '/en/solutions/industries/beauty-and-wellness' },
  industryFinanceInsurance: { href: '/en/solutions/industries/finance-and-insurance' },
  industryTravel: { href: '/en/solutions/industries/travel-and-tourism' },
  industryProfessionalServices: { href: '/en/solutions/industries/professional-services' },
  industryB2b: { href: '/en/solutions/industries/b2b-and-saas' },

  teamSales: { href: '/en/solutions/teams/sales' },
  teamCustomerSupport: { href: '/en/solutions/teams/customer-support' },
  teamMarketing: { href: '/en/solutions/teams/marketing' },
  teamOperationsBooking: { href: '/en/solutions/teams/operations-and-bookings' },
  teamHumanResources: { href: '/en/solutions/teams/human-resources' },
  teamCollections: { href: '/en/solutions/teams/collections' },

  // Con rutas por idioma: se resuelve en LOCALIZED_LINKS
  resources: { href: '/en/resources' },
  // Base de conocimiento y las guías que enlaza Agentes de IA. Con rutas por idioma: LOCALIZED_LINKS
  docs: { href: '/en/docs' },
  docsTestAgent: { href: '/en/docs/test-your-agent-before-publishing' },
  docsHandoff: { href: '/en/docs/handoff-to-a-person' },
  // Con rutas por idioma: se resuelve en LOCALIZED_LINKS
  academy: { href: '/en/academy' },
  // Con rutas por idioma: se resuelve en LOCALIZED_LINKS
  community: { href: '/en/resources/community' },
  // Con rutas por idioma: se resuelve en LOCALIZED_LINKS
  partners: { href: '/en/partners' },
  status: { href: null },
  // Landing E-commerce (tiendas online). Con rutas por idioma: se resuelve en LOCALIZED_LINKS
  ecommerce: { href: '/en/solutions/ecommerce' },
  // Casos de uso. Con rutas por idioma: se resuelve en LOCALIZED_LINKS
  cases: { href: '/en/solutions/use-cases' },

  socialInstagram: { href: 'https://www.instagram.com/gensmart.co/', external: true },
  socialTiktok: { href: 'https://www.tiktok.com/@gensmart.co', external: true },
  socialYoutube: { href: 'https://www.youtube.com/@gensmartco', external: true },
  socialFacebook: { href: 'https://facebook.com/gensmartai', external: true },
  // Con rutas por idioma: se resuelven en LOCALIZED_LINKS
  partnersTiers: { href: '/en/partners#tiers' },
  partnersDirectory: { href: '/en/partners/directory' },
  // Registro de socios: módulo pendiente (se desarrolla al final del refactor)
  partnerSignup: { href: null },
  ...DOC_LINKS,
  ...ACADEMY_LINKS,
};

/**
 * Ruta ya resuelta desde este archivo. El tipo marcado evita que `SiteLink`
 * reciba strings armados a mano: solo los helpers de aquí pueden producirla.
 */
export type SiteHref = string & { readonly __siteHref: unique symbol };

/** Planes con prueba autoservicio. Enterprise no está: va por ventas. */
export type RegisterPlan = 'solo' | 'starter' | 'pro';

/** Registro con el plan preseleccionado (`/register?plan=…`). */
export function registerHref(plan: RegisterPlan): SiteHref {
  const base = SITE_LINKS.register.href ?? '/register';
  const params = new URLSearchParams({ plan });
  return `${base}?${params.toString()}` as SiteHref;
}

/** Variantes de Contacto que se enlazan desde el sitio (`?tipo=`). */
export type ContactLinkVariant = 'partner' | 'directorio' | 'recomendacion' | 'comunidad';

/**
 * Contacto en una variante (`/contacto?tipo=recomendacion&partner=Dysruptia`).
 * El canonical de Contacto sigue sin query.
 */
export function contactVariantHref(
  lang: SiteLanguage,
  tipo: ContactLinkVariant,
  partner?: string
): SiteHref {
  const params = new URLSearchParams({ tipo });
  if (partner) params.set('partner', partner);
  return `${publicPath('contact', lang)}?${params.toString()}` as SiteHref;
}

/** Página del registro, con un ancla opcional por idioma (`/soluciones#equipos`). */
type LocalizedLink = SiteRouteId | { route: SiteRouteId; hash: Record<SiteLanguage, `#${string}`> };

/**
 * Claves que apuntan a páginas con rutas por idioma (lib/site-routes).
 * Se resuelven con el idioma actual: `home` → `/` o `/en`.
 */
const LOCALIZED_LINKS: Partial<Record<SiteLinkKey, LocalizedLink>> = {
  home: 'home',
  pricing: 'pricing',
  product: 'product',
  productAgents: 'productAgents',
  productInbox: 'productInbox',
  productCrm: 'productCrm',
  productBooking: 'productBooking',
  integrations: 'integrations',
  contact: 'contact',
  teamSales: 'teamSales',
  teamCustomerSupport: 'teamCustomerSupport',
  teamMarketing: 'teamMarketing',
  teamOperationsBooking: 'teamOperationsBooking',
  teamHumanResources: 'teamHumanResources',
  teamCollections: 'teamCollections',
  solutions: 'solutions',
  ecommerce: 'ecommerce',
  cases: 'cases',
  // "Ver todas las industrias" (mega menú, footer): el índice, sin ancla, porque arranca por industrias
  industries: { route: 'solutions', hash: { es: '#industrias', en: '#industries' } },
  teams: { route: 'solutions', hash: { es: '#equipos', en: '#teams' } },
  industryEcommerce: 'industryEcommerce',
  industryClinics: 'industryClinics',
  industryRealEstate: 'industryRealEstate',
  industryFieldServices: 'industryFieldServices',
  industryEducation: 'industryEducation',
  industryRestaurants: 'industryRestaurants',
  industryAutomotive: 'industryAutomotive',
  industryBeautyWellness: 'industryBeautyWellness',
  industryFinanceInsurance: 'industryFinanceInsurance',
  industryTravel: 'industryTravel',
  industryProfessionalServices: 'industryProfessionalServices',
  industryB2b: 'industryB2b',
  partners: 'partners',
  partnersTiers: { route: 'partners', hash: { es: '#niveles', en: '#tiers' } },
  partnersDirectory: 'partnersDirectory',
  resources: 'resources',
  community: 'community',
  docs: 'docs',
  academy: 'academy',
  docsTestAgent: 'doc-probar-antes',
  docsHandoff: 'doc-traspaso',
  ...(Object.fromEntries(DOC_ROUTES.map((d) => [docRouteId(d.id), docRouteId(d.id)])) as Record<DocRouteId, DocRouteId>),
  ...(Object.fromEntries(ACADEMY_ROUTES.map((c) => [academyRouteId(c.id), academyRouteId(c.id)])) as Record<
    AcademyRouteId,
    AcademyRouteId
  >),
};

/** `href` de una clave en el idioma dado (`null` = enlace pendiente). */
export function resolveSiteHref(key: SiteLinkKey, lang: SiteLanguage): string | null {
  const link = LOCALIZED_LINKS[key];
  if (!link) return SITE_LINKS[key].href;
  return typeof link === 'string' ? publicPath(link, lang) : `${publicPath(link.route, lang)}${link.hash[lang]}`;
}
