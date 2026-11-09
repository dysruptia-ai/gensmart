import {
  CalendarDays,
  ChartLine,
  GraduationCap,
  Heart,
  House,
  Landmark,
  MessageCircle,
  ShoppingCart,
  Sparkles,
  UtensilsCrossed,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { SiteLinkKey } from '@/lib/site-links';
import { BRAND_LOGOS, type BrandLogo } from '../LogoTile';

export interface DropItem {
  key: SiteLinkKey;
}

export interface IconItem {
  key: SiteLinkKey;
  icon: LucideIcon;
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
  { key: 'docsWhatsappSetup' },
  { key: 'academy' },
  { key: 'community' },
];

export const PARTNERS_ITEMS: DropItem[] = [{ key: 'partners' }, { key: 'referrals' }];

export const TEAM_ITEMS: IconItem[] = [
  { key: 'teamSales', icon: ChartLine },
  { key: 'teamCustomerSupport', icon: MessageCircle },
  { key: 'teamMarketing', icon: Sparkles },
  { key: 'teamOperationsBooking', icon: CalendarDays },
  { key: 'teamHumanResources', icon: Users },
  { key: 'teamCollections', icon: Landmark },
];

export const INDUSTRY_ITEMS: IconItem[] = [
  { key: 'industryEcommerce', icon: ShoppingCart },
  { key: 'industryClinics', icon: Heart },
  { key: 'industryRealEstate', icon: House },
  { key: 'industryRestaurants', icon: UtensilsCrossed },
  { key: 'industryEducation', icon: GraduationCap },
  { key: 'industryFinanceInsurance', icon: Landmark },
];

export const PLATFORM_LOGOS: BrandLogo[] = [
  'Shopify',
  'Tiendanube',
  'WooCommerce',
  'HubSpot',
  'Zoho',
  'Odoo',
  'Google Calendar',
  'Stripe',
].map((name) => {
  const logo = BRAND_LOGOS[name];
  if (!logo) throw new Error(`Logo no definido: ${name}`);
  // En el mega menú los iconos son de 20 px
  return logo.wordmark ? logo : { ...logo, width: 20, height: 20 };
});
