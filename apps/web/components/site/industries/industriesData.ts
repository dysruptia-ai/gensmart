/**
 * Soluciones por industria: estructura de cada página. Los textos van por clave en
 * `site.industries.<id>.*` (i18n), generados desde design/web/industries.mjs.
 * Las secciones son las de `../solutions`.
 */
import type { SiteRouteId } from '@/lib/site-routes';
import type { SolutionData } from '../solutions/solutionsData';

export type IndustryId = Extract<
  SiteRouteId,
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
>;

export interface IndustryData extends SolutionData {
  id: IndustryId;
  subs: number;
  /** Pasos de `{base}.flow` (las vistas del índice). */
  flow: number;
}

export const INDUSTRY_COMMON = 'site.industries.common';

const IMG = '/site/img/industries/';

/** En el orden del diseño (design/web: `INDUSTRIES`). */
export const INDUSTRIES: readonly IndustryData[] = [
  {
    id: 'industryEcommerce',
    base: 'site.industries.industryEcommerce',
    common: INDUSTRY_COMMON,
    slug: 'ecommerce',
    photo: { src: `${IMG}ecommerce.webp`, position: '58% 28%', light: false },
    integrations: ['Tiendanube', 'Shopify', 'WooCommerce', 'Effi', 'Venndelo', 'Dropi', 'Dropea', 'Mastershop'],
    heroChat: ['in', 'out', 'in', 'out'],
    chips: 2,
    subs: 6,
    steps: 5,
    faqs: 5,
    consoleChat: ['in', 'out', 'card', 'in', 'out'],
    did: 3,
    vars: 4,
    initials: 'CA',
    flow: 4,
  },
  {
    id: 'industryClinics',
    base: 'site.industries.industryClinics',
    common: INDUSTRY_COMMON,
    slug: 'clinics',
    photo: { src: `${IMG}clinics.webp`, position: '100% 30%' },
    integrations: ['Google Calendar', 'Gmail', 'Outlook', 'HubSpot', 'Zoho'],
    heroChat: ['in', 'out', 'in', 'out'],
    chips: 2,
    subs: 6,
    steps: 5,
    faqs: 6,
    consoleChat: ['in', 'out', 'in', 'out'],
    did: 3,
    vars: 4,
    initials: 'MA',
    flow: 4,
  },
  {
    id: 'industryRealEstate',
    base: 'site.industries.industryRealEstate',
    common: INDUSTRY_COMMON,
    slug: 'real-estate',
    photo: { src: `${IMG}real-estate.webp`, position: '62% 30%' },
    integrations: ['Google Calendar', 'Gmail', 'HubSpot', 'Wasi', 'Tokko Broker'],
    heroChat: ['in', 'out', 'in', 'out'],
    chips: 2,
    subs: 5,
    steps: 5,
    faqs: 7,
    consoleChat: ['in', 'out', 'in', 'out'],
    did: 3,
    vars: 3,
    score: 8,
    initials: 'VA',
    flow: 4,
  },
  {
    id: 'industryFieldServices',
    base: 'site.industries.industryFieldServices',
    common: INDUSTRY_COMMON,
    slug: 'field-services',
    photo: { src: `${IMG}field-services.webp`, position: '70% 50%' },
    integrations: ['Synchroteam', 'HubSpot', 'Odoo', 'Google Calendar', 'Gmail', 'Google Sheets'],
    heroChat: ['in', 'out', 'in', 'out'],
    chips: 2,
    subs: 5,
    steps: 5,
    faqs: 8,
    consoleChat: ['in', 'out', 'in', 'out'],
    did: 3,
    vars: 2,
    score: 9,
    initials: 'DA',
    flow: 4,
  },
  {
    id: 'industryEducation',
    base: 'site.industries.industryEducation',
    common: INDUSTRY_COMMON,
    slug: 'education',
    photo: { src: `${IMG}education.webp`, position: '70% 30%' },
    integrations: ['Google Calendar', 'Gmail', 'HubSpot', 'Moodle', 'Hotmart', 'Wompi'],
    heroChat: ['in', 'out', 'in', 'out'],
    chips: 2,
    subs: 5,
    steps: 5,
    faqs: 8,
    consoleChat: ['in', 'out', 'in', 'out'],
    did: 3,
    vars: 3,
    score: 8,
    initials: 'DA',
    flow: 4,
  },
  {
    id: 'industryRestaurants',
    base: 'site.industries.industryRestaurants',
    common: INDUSTRY_COMMON,
    slug: 'restaurants',
    photo: { src: `${IMG}restaurants.webp`, position: '75% 35%' },
    integrations: ['Google Calendar', 'Gmail', 'HubSpot', 'Effi', 'Wompi', 'Mercado Pago'],
    heroChat: ['in', 'out', 'in', 'out'],
    chips: 2,
    subs: 5,
    steps: 5,
    faqs: 8,
    consoleChat: ['in', 'out', 'in', 'out'],
    did: 3,
    vars: 3,
    score: 8,
    initials: 'CA',
    flow: 4,
  },
  {
    id: 'industryAutomotive',
    base: 'site.industries.industryAutomotive',
    common: INDUSTRY_COMMON,
    slug: 'automotive',
    photo: { src: `${IMG}automotive.webp`, position: '80% 40%' },
    integrations: ['HubSpot', 'Salesforce', 'Pipedrive', 'Google Calendar', 'Gmail', 'Outlook'],
    heroChat: ['in', 'out', 'in', 'out'],
    chips: 2,
    subs: 5,
    steps: 5,
    faqs: 8,
    consoleChat: ['in', 'out', 'in', 'out'],
    did: 3,
    vars: 2,
    score: 8,
    initials: 'MA',
    flow: 4,
  },
  {
    id: 'industryBeautyWellness',
    base: 'site.industries.industryBeautyWellness',
    common: INDUSTRY_COMMON,
    slug: 'beauty-and-wellness',
    photo: { src: `${IMG}beauty-and-wellness.webp`, position: '85% 35%' },
    integrations: ['AgendaPro', 'Mindbody', 'HubSpot', 'Google Calendar', 'Gmail', 'Wompi'],
    heroChat: ['in', 'out', 'in', 'out'],
    chips: 2,
    subs: 5,
    steps: 5,
    faqs: 8,
    consoleChat: ['in', 'out', 'in', 'out'],
    did: 3,
    vars: 2,
    score: 8,
    initials: 'VA',
    flow: 4,
  },
  {
    id: 'industryFinanceInsurance',
    base: 'site.industries.industryFinanceInsurance',
    common: INDUSTRY_COMMON,
    slug: 'finance-and-insurance',
    photo: { src: `${IMG}finance-and-insurance.webp`, position: '60% 50%' },
    integrations: ['HubSpot', 'Salesforce', 'Siigo', 'QuickBooks', 'Google Calendar', 'Gmail'],
    heroChat: ['in', 'out', 'in', 'out'],
    chips: 2,
    subs: 4,
    steps: 5,
    faqs: 8,
    consoleChat: ['in', 'out', 'in', 'out'],
    did: 3,
    vars: 2,
    score: 8,
    initials: 'NA',
    flow: 4,
  },
  {
    id: 'industryTravel',
    base: 'site.industries.industryTravel',
    common: INDUSTRY_COMMON,
    slug: 'travel-and-tourism',
    photo: { src: `${IMG}travel-and-tourism.webp`, position: '0% 40%' },
    integrations: ['Cloudbeds', 'HubSpot', 'Google Calendar', 'Gmail', 'Stripe', 'Google Sheets'],
    heroChat: ['in', 'out', 'in', 'out'],
    chips: 2,
    subs: 5,
    steps: 5,
    faqs: 8,
    consoleChat: ['in', 'out', 'in', 'out'],
    did: 3,
    vars: 2,
    score: 8,
    initials: 'CA',
    flow: 4,
  },
  {
    id: 'industryProfessionalServices',
    base: 'site.industries.industryProfessionalServices',
    common: INDUSTRY_COMMON,
    slug: 'professional-services',
    photo: { src: `${IMG}professional-services.webp`, position: '70% 40%' },
    integrations: ['HubSpot', 'Google Calendar', 'Gmail', 'Google Drive', 'Siigo', 'Notion'],
    heroChat: ['in', 'out', 'in', 'out'],
    chips: 2,
    subs: 5,
    steps: 5,
    faqs: 8,
    consoleChat: ['in', 'out', 'in', 'out'],
    did: 3,
    vars: 2,
    score: 8,
    initials: 'VA',
    flow: 4,
  },
  {
    id: 'industryB2b',
    base: 'site.industries.industryB2b',
    common: INDUSTRY_COMMON,
    slug: 'b2b-and-saas',
    photo: { src: `${IMG}b2b-and-saas.webp`, position: '45% 40%' },
    integrations: ['HubSpot', 'Google Calendar', 'Gmail', 'Google Sheets', 'Odoo', 'Notion'],
    heroChat: ['in', 'out', 'in', 'out'],
    chips: 2,
    subs: 5,
    steps: 5,
    faqs: 8,
    consoleChat: ['in', 'out', 'in', 'out'],
    did: 3,
    vars: 2,
    score: 8,
    initials: 'MA',
    flow: 4,
  },
];

export const INDUSTRY_SLUGS: readonly string[] = INDUSTRIES.map((industry) => industry.slug);

export function industryBySlug(slug: string): IndustryData | undefined {
  return INDUSTRIES.find((industry) => industry.slug === slug);
}

