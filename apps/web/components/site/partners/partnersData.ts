/**
 * Partners: programa de socios (`/partners`) y directorio (`/partners/directorio`)
 * (design/web: `partners` y `directorio`). Los textos van en `site.partners.*` y
 * `site.partnerDirectory.*`. Sin `'use client'`: las páginas arman con esto los
 * metadatos y el JSON-LD en el servidor, y los componentes pintan lo mismo.
 */
import { PARTNER_PROGRAM } from '@gensmart/shared';
import { formatPercent } from '@/lib/formatters';
import type { SiteT } from '@/lib/site-i18n';
import { absoluteUrl, publicPath, type SiteLanguage } from '@/lib/site-routes';
import { breadcrumbJsonLd, type Crumb } from '../Breadcrumbs/crumbs';
import { faqPageJsonLd, type FaqItem } from '../FaqList/faq';
import { CHANNEL_COUNT } from '../product/productData';
import { SITE_TRIAL_DAYS } from '../siteTrial';

export const P = 'site.partners';
export const D = 'site.partnerDirectory';

export const PARTNERS_CRUMBS: readonly Crumb[] = [
  { id: 'home', labelKey: 'site.crumbs.home' },
  { id: 'partners', labelKey: 'site.crumbs.partners' },
];

export const DIRECTORY_CRUMBS: readonly Crumb[] = [
  ...PARTNERS_CRUMBS,
  { id: 'partnersDirectory', labelKey: 'site.crumbs.partnersDirectory' },
];

/** Anclas por idioma de "¿Tienes una agencia?" (las mismas que `partnersTiers` en lib/site-links). */
export const TIERS_ID: Record<SiteLanguage, string> = { es: 'niveles', en: 'tiers' };
export const WHY_ID = 'por-que';
export const HOW_ID = 'como';
export const SEARCH_ID = 'buscar';

/**
 * Valores del programa para interpolar en los textos: ningún número del programa
 * ni los días de prueba se escriben a mano en i18n.
 */
export function programValues(t: SiteT, lang: SiteLanguage) {
  return {
    percent: formatPercent(PARTNER_PROGRAM.commissionPercent, lang),
    months: PARTNER_PROGRAM.commissionInvoices,
    bonus: PARTNER_PROGRAM.bonusUsd,
    bonusLabel: `$${PARTNER_PROGRAM.bonusUsd}`,
    ordinal: t(`${P}.ordinals.${PARTNER_PROGRAM.bonusOnInvoice}`),
    days: SITE_TRIAL_DAYS,
    channels: CHANNEL_COUNT,
  };
}

export const PARTNER_FAQ_COUNT = 4;

export function partnersFaqItems(t: SiteT, lang: SiteLanguage): FaqItem[] {
  const v = programValues(t, lang);
  return Array.from({ length: PARTNER_FAQ_COUNT }, (_, i) => ({
    question: t(`${P}.faq.items.q${i + 1}.question`, v),
    answer: t(`${P}.faq.items.q${i + 1}.answer`, v),
  }));
}

/* ---------- Directorio ---------- */

export type PartnerService = 'implementation' | 'training' | 'maintenance';
export const PARTNER_SERVICES: readonly PartnerService[] = ['implementation', 'training', 'maintenance'];

export type PartnerLanguage = 'es' | 'en';
export const PARTNER_LANGUAGES: readonly PartnerLanguage[] = ['es', 'en'];

/** País del filtro (design/web: `PAISES`). `latam`: lo cubre un partner que trabaja en "toda Latinoamérica". */
export interface DirectoryCountry {
  code: string;
  name: Record<SiteLanguage, string>;
  latam: boolean;
}

export const COUNTRIES: readonly DirectoryCountry[] = [
  { code: 'ar', name: { es: 'Argentina', en: 'Argentina' }, latam: true },
  { code: 'bo', name: { es: 'Bolivia', en: 'Bolivia' }, latam: true },
  { code: 'br', name: { es: 'Brasil', en: 'Brazil' }, latam: true },
  { code: 'cl', name: { es: 'Chile', en: 'Chile' }, latam: true },
  { code: 'co', name: { es: 'Colombia', en: 'Colombia' }, latam: true },
  { code: 'cr', name: { es: 'Costa Rica', en: 'Costa Rica' }, latam: true },
  { code: 'ec', name: { es: 'Ecuador', en: 'Ecuador' }, latam: true },
  { code: 'sv', name: { es: 'El Salvador', en: 'El Salvador' }, latam: true },
  { code: 'es', name: { es: 'España', en: 'Spain' }, latam: false },
  { code: 'us', name: { es: 'Estados Unidos', en: 'United States' }, latam: false },
  { code: 'gt', name: { es: 'Guatemala', en: 'Guatemala' }, latam: true },
  { code: 'hn', name: { es: 'Honduras', en: 'Honduras' }, latam: true },
  { code: 'mx', name: { es: 'México', en: 'Mexico' }, latam: true },
  { code: 'ni', name: { es: 'Nicaragua', en: 'Nicaragua' }, latam: true },
  { code: 'pa', name: { es: 'Panamá', en: 'Panama' }, latam: true },
  { code: 'py', name: { es: 'Paraguay', en: 'Paraguay' }, latam: true },
  { code: 'pe', name: { es: 'Perú', en: 'Peru' }, latam: true },
  { code: 'pr', name: { es: 'Puerto Rico', en: 'Puerto Rico' }, latam: true },
  { code: 'do', name: { es: 'República Dominicana', en: 'Dominican Republic' }, latam: true },
  { code: 'uy', name: { es: 'Uruguay', en: 'Uruguay' }, latam: true },
  { code: 've', name: { es: 'Venezuela', en: 'Venezuela' }, latam: true },
];

/**
 * Ficha del directorio. Los textos van en `site.partnerDirectory.partners.<key>`.
 * Fuente temporal: el directorio pasará a salir del módulo de socios.
 */
export interface DirectoryPartner {
  key: 'dysruptia' | 'dataSolutions';
  /** Nombre propio: no se traduce. También es el valor de `?partner=` en Contacto. */
  name: string;
  url: string;
  /** Logo por idioma (el de Dysruptia cambia de idioma), en `public/site/img/partners`. */
  logo: Record<SiteLanguage, { src: string; width: number; height: number }>;
  services: readonly PartnerService[];
  /** Códigos de país de `COUNTRIES`, más `latam` para toda Latinoamérica. */
  countries: readonly string[];
  languages: readonly PartnerLanguage[];
}

const DYS_ES = { src: '/site/img/partners/partner-dys-es.webp', width: 520, height: 302 };
const DYS_EN = { src: '/site/img/partners/partner-dys-en.webp', width: 520, height: 295 };
const DSG = { src: '/site/img/partners/partner-datasolutions.webp', width: 182, height: 138 };

// Fuente temporal: el directorio pasará a salir del módulo de socios
export const DIRECTORY_PARTNERS: readonly DirectoryPartner[] = [
  {
    key: 'dysruptia',
    name: 'Dysruptia',
    url: 'https://www.dysruptia.co/',
    logo: { es: DYS_ES, en: DYS_EN },
    services: ['implementation', 'training', 'maintenance'],
    countries: ['co', 'latam', 'us'],
    languages: ['es', 'en'],
  },
  {
    key: 'dataSolutions',
    name: 'Data Solutions Group',
    url: 'https://www.dsldatasolutions.com/',
    logo: { es: DSG, en: DSG },
    services: ['implementation', 'training'],
    countries: ['co', 'latam'],
    languages: ['es', 'en'],
  },
];

/** Partner del directorio por su nombre exacto (para `?partner=` en Contacto), o `null`. */
export function findDirectoryPartner(name: string | null): DirectoryPartner | null {
  if (!name) return null;
  // Sin distinguir mayúsculas ni espacios de más: `?partner=dysruptia` también sirve.
  const key = name.trim().toLocaleLowerCase();
  return DIRECTORY_PARTNERS.find((p) => p.name.toLocaleLowerCase() === key) ?? null;
}

/** ¿El partner trabaja en ese país? (`latam` cubre todos los de Latinoamérica). */
export function servesCountry(partner: DirectoryPartner, code: string): boolean {
  if (partner.countries.includes(code)) return true;
  const country = COUNTRIES.find((c) => c.code === code);
  return Boolean(country?.latam && partner.countries.includes('latam'));
}

/* ---------- JSON-LD ---------- */

/** Partners: `BreadcrumbList` y `FAQPage`. */
export function partnersJsonLd(t: SiteT, lang: SiteLanguage) {
  const url = absoluteUrl(publicPath('partners', lang));
  return {
    '@context': 'https://schema.org',
    '@graph': [breadcrumbJsonLd(PARTNERS_CRUMBS, t, lang), faqPageJsonLd(partnersFaqItems(t, lang), url, lang)],
  };
}

/** Directorio: `BreadcrumbList` e `ItemList`. */
export function directoryJsonLd(t: SiteT, lang: SiteLanguage) {
  return {
    '@context': 'https://schema.org',
    '@graph': [breadcrumbJsonLd(DIRECTORY_CRUMBS, t, lang), directoryItemListJsonLd(t, lang)],
  };
}

/** `ItemList` con cada partner como `Organization`. */
function directoryItemListJsonLd(t: SiteT, lang: SiteLanguage) {
  const url = absoluteUrl(publicPath('partnersDirectory', lang));
  return {
    '@type': 'ItemList',
    '@id': `${url}#partners`,
    name: t('site.meta.partnersDirectory.ogAlt'),
    numberOfItems: DIRECTORY_PARTNERS.length,
    itemListElement: DIRECTORY_PARTNERS.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Organization',
        name: p.name,
        url: p.url,
        description: t(`${D}.partners.${p.key}.description`),
        areaServed: t(`${D}.partners.${p.key}.where`),
        knowsLanguage: p.languages,
      },
    })),
  };
}
