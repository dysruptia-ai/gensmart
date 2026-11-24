/**
 * Lógica de servidor de la base de conocimiento sobre `docsData.ts`: búsqueda por slug,
 * orden de lectura, planes (desde `PLAN_LIMITS`), fechas, metadatos, JSON-LD e índice
 * de búsqueda. Sin `'use client'`: solo lo importan páginas, rutas y componentes de servidor.
 */
import type { Metadata } from 'next';
import { PLAN_LIMITS, isChannelAllowedOnPlan, type DocId } from '@gensmart/shared';
import { breadcrumbJsonLd, type Crumb } from '@/components/site/Breadcrumbs/crumbs';
import { DOC_GROUP_ORDER, DOC_READING_ORDER, docRouteId } from '@/lib/docs-routes';
import type { SiteT } from '@/lib/site-i18n';
import { sitePageMetadata } from '@/lib/site-metadata';
import { SITE_ORIGIN, absoluteUrl, publicPath, type SiteLanguage } from '@/lib/site-routes';
import { DOCS, DOC_GROUP_DATA, type DocData, type DocGroupData, type DocPlanFeature } from './docsData';

export function docById(id: DocId): DocData {
  const doc = DOCS.find((d) => d.id === id);
  if (!doc) throw new Error(`docs: guía desconocida ${id}`);
  return doc;
}

export function groupById(id: DocData['group']): DocGroupData {
  const group = DOC_GROUP_DATA.find((g) => g.id === id);
  if (!group) throw new Error(`docs: grupo desconocido ${id}`);
  return group;
}

/** Guía por el slug de la ruta interna (`/docs/[doc]` usa el slug en inglés). */
export function docByInternalSlug(slug: string): DocData | undefined {
  return DOCS.find((d) => d.slug.en === slug);
}

export function docsInGroup(group: DocData['group']): DocData[] {
  return DOCS.filter((d) => d.group === group);
}

export const ORDERED_GROUPS: readonly DocGroupData[] = DOC_GROUP_ORDER.map(groupById);

export function prevNext(id: DocId): { prev: DocData | null; next: DocData | null } {
  const i = DOC_READING_ORDER.indexOf(id);
  const prev = DOC_READING_ORDER[i - 1];
  const next = DOC_READING_ORDER[i + 1];
  return { prev: prev ? docById(prev) : null, next: next ? docById(next) : null };
}

/* ---------- Planes: "Disponible en los planes" ---------- */

type PlanKey = keyof typeof PLAN_LIMITS;
const PLAN_ORDER: readonly PlanKey[] = ['solo', 'starter', 'pro', 'enterprise'];
const PLAN_NAMES: Record<PlanKey, string> = { solo: 'Solo', starter: 'Starter', pro: 'Pro', enterprise: 'Enterprise' };

function planHasFeature(plan: PlanKey, feature: DocPlanFeature): boolean {
  if (feature === 'whatsapp') return isChannelAllowedOnPlan(plan, 'whatsapp');
  return PLAN_LIMITS[plan].humanTakeover;
}

/** Planes con la función, o `null` si la tienen todos (entonces no se muestra la etiqueta). */
export function docPlans(doc: DocData): string[] | null {
  if (!doc.planFeature) return null;
  const feature = doc.planFeature;
  const plans = PLAN_ORDER.filter((plan) => planHasFeature(plan, feature));
  return plans.length === PLAN_ORDER.length ? null : plans.map((plan) => PLAN_NAMES[plan]);
}

/* ---------- Fechas ---------- */

const MONTHS: Record<SiteLanguage, readonly string[]> = {
  es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

/** "24 nov 2026" / "Nov 24, 2026" (como el diseño, sin depender de Intl del servidor). */
export function formatDocDate(iso: string, lang: SiteLanguage): string {
  const [y, m, d] = iso.split('-').map(Number);
  const month = MONTHS[lang][(m ?? 1) - 1];
  return lang === 'en' ? `${month} ${d}, ${y}` : `${d} ${month} ${y}`;
}

/* ---------- Metadatos ---------- */

const TITLE_MAX = 60;

/** `{título} | Ayuda de GenSmart`; si pasa de 60, `{título} | GenSmart`; si aún pasa, solo el título. */
export function docTitle(doc: DocData, lang: SiteLanguage, t: SiteT): string {
  const title = doc.title[lang];
  const full = `${title} | ${t('site.meta.docs.guideSuffix')}`;
  if (full.length <= TITLE_MAX) return full;
  const short = `${title} | GenSmart`;
  return short.length <= TITLE_MAX ? short : title;
}

export function docsIndexMetadata(lang: SiteLanguage, t: SiteT): Metadata {
  return sitePageMetadata('docs', lang, {
    title: t('site.meta.docs.title'),
    description: t('site.meta.docs.description'),
    ogAlt: t('site.meta.docs.ogAlt'),
  });
}

export function docMetadata(doc: DocData, lang: SiteLanguage, t: SiteT): Metadata {
  const meta = sitePageMetadata(docRouteId(doc.id), lang, {
    title: docTitle(doc, lang, t),
    description: doc.summary[lang],
    ogAlt: doc.title[lang],
  });
  return { ...meta, openGraph: { ...meta.openGraph, type: 'article', modifiedTime: doc.updated } };
}

/* ---------- Migas y JSON-LD ---------- */

export const DOCS_INDEX_CRUMBS: readonly Crumb[] = [
  { id: 'home', labelKey: 'site.crumbs.home' },
  { id: 'docs', labelKey: 'site.crumbs.docs' },
];

/** Inicio / Base de conocimiento / {Grupo} (sin URL: texto) / {Guía}. */
export function docCrumbs(doc: DocData, lang: SiteLanguage): Crumb[] {
  return [
    { id: 'home', labelKey: 'site.crumbs.home' },
    { id: 'docs', labelKey: 'site.crumbs.docs' },
    { id: null, labelKey: `docs-group-${doc.group}`, label: groupById(doc.group).name[lang] },
    { id: docRouteId(doc.id), labelKey: `docs-guide-${doc.id}`, label: doc.title[lang] },
  ];
}

const ORGANIZATION = {
  '@type': 'Organization',
  '@id': `${SITE_ORIGIN}/#organization`,
  name: 'GenSmart',
  url: `${SITE_ORIGIN}/`,
};

function docUrl(doc: DocData, lang: SiteLanguage): string {
  return absoluteUrl(publicPath(docRouteId(doc.id), lang));
}

export function docsIndexJsonLd(lang: SiteLanguage, t: SiteT): object {
  const url = absoluteUrl(publicPath('docs', lang));
  return {
    '@context': 'https://schema.org',
    '@graph': [
      breadcrumbJsonLd(DOCS_INDEX_CRUMBS, t, lang),
      {
        '@type': 'CollectionPage',
        '@id': `${url}#page`,
        url,
        name: t('site.meta.docs.title'),
        description: t('site.meta.docs.description'),
        inLanguage: lang,
        isPartOf: { '@type': 'WebSite', '@id': `${SITE_ORIGIN}/#website`, url: `${SITE_ORIGIN}/`, name: 'GenSmart' },
        publisher: ORGANIZATION,
        hasPart: DOC_READING_ORDER.map(docById).map((doc) => ({
          '@type': 'TechArticle',
          '@id': `${docUrl(doc, lang)}#article`,
          headline: doc.title[lang],
          url: docUrl(doc, lang),
        })),
      },
    ],
  };
}

function isoDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `PT${m ? `${m}M` : ''}${s ? `${s}S` : ''}`;
}

export function docJsonLd(doc: DocData, lang: SiteLanguage, t: SiteT): object {
  const url = docUrl(doc, lang);
  const graph: object[] = [
    breadcrumbJsonLd(docCrumbs(doc, lang), t, lang),
    {
      '@type': 'TechArticle',
      '@id': `${url}#article`,
      headline: doc.title[lang],
      description: doc.summary[lang],
      inLanguage: lang,
      dateModified: doc.updated,
      author: ORGANIZATION,
      publisher: ORGANIZATION,
      mainEntityOfPage: { '@type': 'WebPage', '@id': url },
      isPartOf: { '@type': 'CollectionPage', '@id': `${absoluteUrl(publicPath('docs', lang))}#page` },
    },
  ];
  const video = doc.body.find((b) => b.kind === 'video');
  const chapters = doc.body.find((b) => b.kind === 'chapters');
  if (video && video.kind === 'video') {
    const watch = `https://www.youtube.com/watch?v=${video.videoId}`;
    graph.push({
      '@type': 'VideoObject',
      '@id': `${url}#video`,
      name: video.title[lang],
      description: doc.summary[lang],
      thumbnailUrl: `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`,
      embedUrl: `https://www.youtube-nocookie.com/embed/${video.videoId}`,
      contentUrl: watch,
      duration: isoDuration(video.durationSec),
      inLanguage: lang,
      // Fecha de publicación en YouTube (confirmada por el usuario el 2026-11-24)
      uploadDate: '2026-11-09',
      hasPart:
        chapters && chapters.kind === 'chapters'
          ? chapters.items.map((c, i) => ({
              '@type': 'Clip',
              name: c.title[lang],
              startOffset: c.start,
              endOffset: chapters.items[i + 1]?.start ?? video.durationSec,
              url: `${watch}&t=${c.start}`,
            }))
          : undefined,
    });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}

/* ---------- Índice de búsqueda ---------- */

export interface DocSearchEntry {
  href: string;
  title: string;
  summary: string;
  group: string;
  /** Títulos de las secciones (`h2`). */
  headings: string[];
}

export function docsSearchIndex(lang: SiteLanguage): DocSearchEntry[] {
  return DOC_READING_ORDER.map(docById).map((doc) => ({
    href: publicPath(docRouteId(doc.id), lang),
    title: doc.title[lang],
    summary: doc.summary[lang].replace(/\*\*/g, ''),
    group: groupById(doc.group).name[lang],
    headings: doc.body.flatMap((b) => (b.kind === 'h2' ? [b.text[lang].replace(/\*\*/g, '')] : [])),
  }));
}
