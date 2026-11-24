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
  | 'docsWhatsappSetup'
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
  | 'partnersDirectory';

import { publicPath, type SiteLanguage, type SiteRouteId } from './site-routes';

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

  resources: { href: null },
  docs: { href: null },
  docsWhatsappSetup: { href: '/docs/whatsapp-setup' },
  // Guías de la base de conocimiento: pendientes hasta migrarla
  docsTestAgent: { href: null },
  docsHandoff: { href: null },
  academy: { href: null },
  community: { href: null },
  partners: { href: null },
  cases: { href: null },
  status: { href: null },
  // Landing E-commerce (tiendas online). Con rutas por idioma: se resuelve en LOCALIZED_LINKS
  ecommerce: { href: '/en/solutions/ecommerce' },

  socialInstagram: { href: 'https://www.instagram.com/gensmart.co/', external: true },
  socialTiktok: { href: 'https://www.tiktok.com/@gensmart.co', external: true },
  socialYoutube: { href: 'https://www.youtube.com/@gensmartco', external: true },
  socialFacebook: { href: 'https://facebook.com/gensmartai', external: true },
  partnersTiers: { href: null },
  partnersDirectory: { href: null },
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
};

/** `href` de una clave en el idioma dado (`null` = enlace pendiente). */
export function resolveSiteHref(key: SiteLinkKey, lang: SiteLanguage): string | null {
  const link = LOCALIZED_LINKS[key];
  if (!link) return SITE_LINKS[key].href;
  return typeof link === 'string' ? publicPath(link, lang) : `${publicPath(link.route, lang)}${link.hash[lang]}`;
}
