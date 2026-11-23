import type { SiteLinkKey } from '@/lib/site-links';
import { BRAND_LOGOS, type BrandLogo } from '../LogoTile';

export interface DropItem {
  key: SiteLinkKey;
}

/** Ítem del mega menú: nombre y una línea de contexto (`site.mega.items.<key>`). */
export interface MegaItem {
  key: SiteLinkKey;
}

export const PRODUCT_ITEMS: DropItem[] = [
  { key: 'product' },
  { key: 'productAgents' },
  { key: 'productInbox' },
  { key: 'productCrm' },
  { key: 'productBooking' },
  { key: 'integrations' },
];

export const RESOURCES_ITEMS: DropItem[] = [
  { key: 'resources' },
  { key: 'blog' },
  // Base de conocimiento: hoy la única guía en Next es la de WhatsApp.
  // Cuando migremos la base de conocimiento, cambiar a `docs`.
  { key: 'docsWhatsappSetup' },
  { key: 'academy' },
  { key: 'community' },
];

export const TEAM_ITEMS: MegaItem[] = [
  { key: 'teamSales' },
  { key: 'teamCustomerSupport' },
  { key: 'teamMarketing' },
  { key: 'teamOperationsBooking' },
  { key: 'teamHumanResources' },
  { key: 'teamCollections' },
];

export const INDUSTRY_ITEMS: MegaItem[] = [
  { key: 'industryEcommerce' },
  { key: 'industryClinics' },
  { key: 'industryRealEstate' },
  { key: 'industryRestaurants' },
  { key: 'industryEducation' },
  { key: 'industryFinanceInsurance' },
];

export const PLATFORM_LOGOS: BrandLogo[] = [
  'Shopify',
  'Tiendanube',
  'WooCommerce',
  'HubSpot',
  'Zoho',
  'Odoo',
  'Calendly',
  'Stripe',
].map((name) => {
  const logo = BRAND_LOGOS[name];
  if (!logo) throw new Error(`Logo no definido: ${name}`);
  // En el mega menú los iconos son de 20 px
  return logo.wordmark ? logo : { ...logo, width: 20, height: 20 };
});
