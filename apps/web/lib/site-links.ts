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

  industries: { href: null },
  industryEcommerce: { href: null },
  industryClinics: { href: null },
  industryRealEstate: { href: null },
  industryRestaurants: { href: null },
  industryEducation: { href: null },
  industryFinanceInsurance: { href: null },

  // Índice de Soluciones: llega con las industrias (web-25)
  teams: { href: null },
  // Con rutas por idioma: se resuelven en LOCALIZED_LINKS
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
  ecommerce: { href: null },

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

/**
 * Claves que apuntan a páginas con rutas por idioma (lib/site-routes).
 * Se resuelven con el idioma actual: `home` → `/` o `/en`.
 */
const LOCALIZED_LINKS: Partial<Record<SiteLinkKey, SiteRouteId>> = {
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
};

/** `href` de una clave en el idioma dado (`null` = enlace pendiente). */
export function resolveSiteHref(key: SiteLinkKey, lang: SiteLanguage): string | null {
  const routeId = LOCALIZED_LINKS[key];
  return routeId ? publicPath(routeId, lang) : SITE_LINKS[key].href;
}
