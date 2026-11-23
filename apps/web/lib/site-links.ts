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
  | 'academy'
  | 'community'
  | 'partners'
  | 'referrals'
  | 'cases'
  | 'status'
  | 'ecommerce'
  | 'socialInstagram'
  | 'socialTiktok'
  | 'socialYoutube'
  | 'socialFacebook'
  | 'partnersWhiteLabel';

export interface SiteLinkTarget {
  href: string | null;
  external?: boolean;
}

export const SITE_LINKS: Record<SiteLinkKey, SiteLinkTarget> = {
  home: { href: '/' },
  pricing: { href: '/pricing' },
  blog: { href: '/blog' },
  contact: { href: '/contact' },
  about: { href: '/about' },
  login: { href: '/login' },
  register: { href: '/register' },
  legalTerms: { href: '/legal/terms-of-service' },
  legalPrivacy: { href: '/legal/privacy-policy' },
  legalCookies: { href: '/legal/cookie-policy' },

  product: { href: null },
  productAgents: { href: null },
  productInbox: { href: null },
  productCrm: { href: null },
  productBooking: { href: null },
  integrations: { href: null },

  industries: { href: null },
  industryEcommerce: { href: null },
  industryClinics: { href: null },
  industryRealEstate: { href: null },
  industryRestaurants: { href: null },
  industryEducation: { href: null },
  industryFinanceInsurance: { href: null },

  teams: { href: null },
  teamSales: { href: null },
  teamCustomerSupport: { href: null },
  teamMarketing: { href: null },
  teamOperationsBooking: { href: null },
  teamHumanResources: { href: null },
  teamCollections: { href: null },

  resources: { href: null },
  docs: { href: null },
  docsWhatsappSetup: { href: '/docs/whatsapp-setup' },
  academy: { href: null },
  community: { href: null },
  partners: { href: null },
  referrals: { href: null },
  cases: { href: null },
  status: { href: null },
  ecommerce: { href: null },

  socialInstagram: { href: 'https://www.instagram.com/gensmart.co/', external: true },
  socialTiktok: { href: 'https://www.tiktok.com/@gensmart.co', external: true },
  socialYoutube: { href: 'https://www.youtube.com/@gensmartco', external: true },
  socialFacebook: { href: 'https://facebook.com/gensmartai', external: true },
  partnersWhiteLabel: { href: null },
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
