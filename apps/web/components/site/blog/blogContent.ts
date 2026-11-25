/**
 * Lógica de servidor del blog sobre `lib/blog.ts`: la configuración del diseño
 * (`RUTAS`, `GUIA`, `DEST`, `MIN_CAT`), relacionados, fechas, metadatos y JSON-LD.
 * Sin `'use client'`: solo lo importan páginas, rutas y componentes de servidor.
 */
import type { Metadata } from 'next';
import { breadcrumbJsonLd, type Crumb } from '@/components/site/Breadcrumbs/crumbs';
import { getAllPosts, getPostById, getPostsByCategory, type BlogPost } from '@/lib/blog';
import {
  BLOG_CATEGORY_ROUTES,
  blogCategoryRouteId,
  blogPostRouteId,
  type BlogCategoryId,
} from '@/lib/blog-routes';
import type { SiteT } from '@/lib/site-t';
import { OG_LOCALE, sitePageMetadata } from '@/lib/site-metadata';
import { SITE_ORIGIN, absoluteUrl, otherLanguage, publicPath, type SiteLanguage } from '@/lib/site-routes';

/* ---------- Configuración del diseño (design/web: rutas.mjs y build.mjs) ---------- */

/** Una categoría necesita tres artículos para indexarse (`MIN_CAT`). */
export const MIN_CAT = 3;

/** Artículos por tanda en "Todos los artículos". */
export const PAGE_SIZE = 12;

export type BlogPathId = 'empieza' | 'venta' | 'en-vivo' | 'citable';

export interface BlogPath {
  id: BlogPathId;
  /** Categoría a la que pertenece (se muestra en su página). */
  category: BlogCategoryId;
  /** Ids de los artículos, en orden de lectura. */
  posts: readonly string[];
}

/** Rutas de lectura (`RUTAS`). Los nombres y descripciones están en `site.blog.paths.items`. */
export const BLOG_PATHS: readonly BlogPath[] = [
  {
    id: 'empieza',
    category: 'agentes',
    posts: [
      'que-es-una-plataforma-agentica',
      'que-es-un-agente-de-ia-multicanal',
      'como-funciona-un-agente-de-ia-por-dentro',
      'que-puede-y-que-no-puede-hacer-un-agente-de-ia',
      'guia-para-empezar-con-ia-conversacional-en-una-pyme',
    ],
  },
  {
    id: 'venta',
    category: 'crm',
    posts: [
      'embudo-de-ventas-por-conversaciones',
      'de-contacto-nuevo-a-cita-agendada',
      'puntaje-de-leads-con-ia-explicado',
      'preguntas-para-calificar-a-un-prospecto',
      'seguimiento-a-clientes-que-no-responden',
      'como-medir-si-tu-agente-de-ventas-funciona',
    ],
  },
  {
    id: 'en-vivo',
    category: 'whatsapp',
    posts: [
      'conectar-whatsapp-en-dos-clics',
      'ventana-de-24-horas-de-whatsapp-business',
      'como-escribir-la-base-de-conocimiento-de-tu-agente',
      'como-desplegar-un-agente-de-ia-en-whatsapp',
      'checklist-antes-de-poner-tu-agente-en-vivo',
    ],
  },
  {
    id: 'citable',
    category: 'marketing',
    posts: [
      'seo-aeo-y-geo-que-es-cada-uno',
      'que-es-geo-y-por-que-tu-negocio-debe-ser-citable-por-la-ia',
      'como-escribir-contenido-que-google-y-la-ia-puedan-citar',
    ],
  },
];

/** El artículo para empezar en cada categoría (`GUIA`). */
export const BLOG_GUIDE: Partial<Record<BlogCategoryId, string>> = {
  agentes: 'que-es-una-plataforma-agentica',
  whatsapp: 'ventana-de-24-horas-de-whatsapp-business',
  marketing: 'seo-aeo-y-geo-que-es-cada-uno',
  crm: 'embudo-de-ventas-por-conversaciones',
  atencion: 'como-responder-mensajes-fuera-de-horario',
};

/** "Lo más leído para empezar" (`DEST`). */
export const BLOG_FEATURED: readonly string[] = [
  'que-es-un-agente-de-ia-multicanal',
  'agendar-citas-por-whatsapp-con-un-agente-de-ia',
  'embudo-de-ventas-por-conversaciones',
  'que-pasa-despues-del-clic-en-un-anuncio',
];

/* ---------- Consultas ---------- */

function mustPost(id: string, lang: SiteLanguage): BlogPost {
  const post = getPostById(id, lang);
  if (!post) throw new Error(`blog: artículo desconocido ${id}`);
  return post;
}

export function pathPosts(path: BlogPath, lang: SiteLanguage): BlogPost[] {
  return path.posts.map((id) => mustPost(id, lang));
}

export function pathOf(post: BlogPost): BlogPath | undefined {
  return BLOG_PATHS.find((p) => p.posts.includes(post.id));
}

export function guideOf(category: BlogCategoryId, lang: SiteLanguage): BlogPost | undefined {
  const id = BLOG_GUIDE[category];
  return id ? mustPost(id, lang) : undefined;
}

export function featuredPosts(lang: SiteLanguage): BlogPost[] {
  return BLOG_FEATURED.map((id) => mustPost(id, lang));
}

/** Categorías con artículos, en el orden del diseño, con su contador. */
export function categoriesWithCount(lang: SiteLanguage): Array<{ id: BlogCategoryId; count: number }> {
  return BLOG_CATEGORY_ROUTES.map((c) => ({ id: c.id, count: getPostsByCategory(c.id, lang).length })).filter(
    (c) => c.count > 0
  );
}

export function latestPosts(lang: SiteLanguage, n = 4, exclude?: string): BlogPost[] {
  return getAllPosts(lang)
    .filter((p) => p.id !== exclude)
    .slice(0, n);
}

/** 3 relacionados: primero los de la ruta, luego los de la categoría y después el resto. */
export function relatedPosts(post: BlogPost, lang: SiteLanguage): BlogPost[] {
  const all = getAllPosts(lang);
  const others = all.filter((p) => p.id !== post.id);
  const path = pathOf(post);
  const fromPath = path ? pathPosts(path, lang).filter((p) => p.id !== post.id) : [];
  const ordered = [
    ...fromPath,
    ...others.filter((p) => p.category === post.category),
    ...others.filter((p) => p.category !== post.category),
  ];
  return ordered.filter((p, i) => ordered.findIndex((q) => q.id === p.id) === i).slice(0, 3);
}

/* ---------- Fechas ---------- */

const MONTHS: Record<SiteLanguage, readonly string[]> = {
  es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

/** "24 nov 2026" / "Nov 24, 2026" (design/web: `fecha`). */
export function formatPostDate(iso: string, lang: SiteLanguage): string {
  const [y, m, d] = iso.split('-').map(Number);
  const month = MONTHS[lang][(m ?? 1) - 1];
  return lang === 'en' ? `${month} ${d}, ${y}` : `${d} ${month} ${y}`;
}

/* ---------- Rutas ---------- */

export function postUrl(post: BlogPost, lang: SiteLanguage = post.language): string {
  return absoluteUrl(publicPath(blogPostRouteId(post.id), lang));
}

export function categoryUrl(id: BlogCategoryId, lang: SiteLanguage): string {
  return absoluteUrl(publicPath(blogCategoryRouteId(id), lang));
}

/** RSS por idioma: `/blog/rss.xml` y `/en/blog/rss.xml`. */
export function rssPath(lang: SiteLanguage): string {
  return lang === 'es' ? '/blog/rss.xml' : '/en/blog/rss.xml';
}

/* ---------- Metadatos ---------- */

const TITLE_MAX = 60;

/** `{título} | GenSmart`; si pasa de 60, solo el título (corrección 1). */
/** `<title>`: `seoTitle` si existe; si no, `{title} | GenSmart` si cabe en 60, o `{title}`. */
export function postTitle(post: BlogPost): string {
  if (post.seoTitle) return post.seoTitle;
  const full = `${post.title} | GenSmart`;
  return full.length <= TITLE_MAX ? full : post.title;
}

function withRss(meta: Metadata, lang: SiteLanguage, t: SiteT): Metadata {
  return {
    ...meta,
    alternates: {
      ...meta.alternates,
      types: { 'application/rss+xml': [{ url: rssPath(lang), title: t('site.meta.blog.rss') }] },
    },
  };
}

export function blogIndexMetadata(lang: SiteLanguage, t: SiteT): Metadata {
  return withRss(
    sitePageMetadata('blog', lang, {
      title: t('site.meta.blog.title'),
      description: t('site.meta.blog.description'),
      ogAlt: t('site.meta.blog.ogAlt'),
    }),
    lang,
    t
  );
}

export function blogCategoryMetadata(id: BlogCategoryId, lang: SiteLanguage, t: SiteT): Metadata {
  const name = t(`site.blog.categories.${id}.name`);
  const meta = sitePageMetadata(blogCategoryRouteId(id), lang, {
    title: t('site.meta.blog.categoryTitle', { name }),
    description: t(`site.blog.categories.${id}.desc`),
    ogAlt: t('site.meta.blog.ogAlt'),
  });
  // Página delgada: existe para navegar, no para posicionar (design/web: `noindex` bajo `MIN_CAT`)
  const thin = getPostsByCategory(id, lang).length < MIN_CAT;
  return withRss(thin ? { ...meta, robots: { index: false, follow: true } } : meta, lang, t);
}

export function blogPostMetadata(post: BlogPost, lang: SiteLanguage, t: SiteT): Metadata {
  const meta = sitePageMetadata(blogPostRouteId(post.id), lang, {
    title: postTitle(post),
    description: post.description,
    ogAlt: post.title,
    // Primera página con imagen OG propia: su portada en el idioma de la página
    ogImage: { url: post.cover, width: 1200, height: 900 },
  });
  return withRss(
    {
      ...meta,
      // `<title>` y `<meta name="description">` usan las versiones SEO; al compartir, el título completo
      description: post.seoDescription ?? post.description,
      twitter: { ...meta.twitter, title: post.title, description: post.description },
      openGraph: {
        ...meta.openGraph,
        title: post.title,
        description: post.description,
        type: 'article',
        publishedTime: post.date,
        modifiedTime: post.updated,
        authors: ['GenSmart'],
        section: t(`site.blog.categories.${post.category}.name`),
        locale: OG_LOCALE[lang],
        alternateLocale: [OG_LOCALE[otherLanguage(lang)]],
      },
    },
    lang,
    t
  );
}

/* ---------- Migas ---------- */

export const BLOG_INDEX_CRUMBS: readonly Crumb[] = [
  { id: 'home', labelKey: 'site.crumbs.home' },
  { id: 'blog', labelKey: 'site.crumbs.blog' },
];

export function categoryCrumbs(id: BlogCategoryId, t: SiteT): Crumb[] {
  return [
    ...BLOG_INDEX_CRUMBS,
    { id: blogCategoryRouteId(id), labelKey: `blog-cat-${id}`, label: t(`site.blog.categories.${id}.name`) },
  ];
}

/** Inicio / Blog / {Categoría} / {Artículo} (el JSON-LD; las migas visibles terminan en la categoría). */
export function postCrumbs(post: BlogPost, t: SiteT): Crumb[] {
  return [
    ...categoryCrumbs(post.category, t),
    { id: blogPostRouteId(post.id), labelKey: `blog-post-${post.id}`, label: post.title },
  ];
}

/* ---------- JSON-LD ---------- */

const ORGANIZATION = {
  '@type': 'Organization',
  '@id': `${SITE_ORIGIN}/#organization`,
  name: 'GenSmart',
  url: `${SITE_ORIGIN}/`,
  logo: { '@type': 'ImageObject', url: `${SITE_ORIGIN}/android-chrome-512x512.png`, width: 512, height: 512 },
};

const IN_LANGUAGE: Record<SiteLanguage, string> = { es: 'es', en: 'en' };

export function blogIndexJsonLd(lang: SiteLanguage, t: SiteT): object {
  const url = absoluteUrl(publicPath('blog', lang));
  return {
    '@context': 'https://schema.org',
    '@graph': [
      breadcrumbJsonLd(BLOG_INDEX_CRUMBS, t, lang),
      {
        '@type': 'Blog',
        '@id': `${url}#blog`,
        url,
        name: t('site.meta.blog.title'),
        description: t('site.meta.blog.description'),
        inLanguage: IN_LANGUAGE[lang],
        publisher: ORGANIZATION,
        blogPost: getAllPosts(lang).map((post) => ({
          '@type': 'BlogPosting',
          '@id': `${postUrl(post)}#article`,
          headline: post.title,
          url: postUrl(post),
          datePublished: post.date,
        })),
      },
    ],
  };
}

export function blogCategoryJsonLd(id: BlogCategoryId, lang: SiteLanguage, t: SiteT): object {
  const url = categoryUrl(id, lang);
  const posts = getPostsByCategory(id, lang);
  return {
    '@context': 'https://schema.org',
    '@graph': [
      breadcrumbJsonLd(categoryCrumbs(id, t), t, lang),
      {
        '@type': 'CollectionPage',
        '@id': `${url}#page`,
        url,
        name: t(`site.blog.categories.${id}.name`),
        description: t(`site.blog.categories.${id}.desc`),
        inLanguage: IN_LANGUAGE[lang],
        isPartOf: { '@type': 'Blog', '@id': `${absoluteUrl(publicPath('blog', lang))}#blog` },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: posts.length,
          itemListElement: posts.map((post, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            url: postUrl(post),
            name: post.title,
          })),
        },
      },
    ],
  };
}

export function blogPostJsonLd(post: BlogPost, lang: SiteLanguage, t: SiteT): object {
  const url = postUrl(post);
  const graph: object[] = [
    breadcrumbJsonLd(postCrumbs(post, t), t, lang),
    {
      '@type': 'BlogPosting',
      '@id': `${url}#article`,
      headline: post.title,
      description: post.description,
      image: { '@type': 'ImageObject', url: absoluteUrl(post.cover), width: 1200, height: 900 },
      datePublished: post.date,
      dateModified: post.updated,
      inLanguage: IN_LANGUAGE[lang],
      author: ORGANIZATION,
      publisher: ORGANIZATION,
      mainEntityOfPage: { '@type': 'WebPage', '@id': url },
      articleSection: t(`site.blog.categories.${post.category}.name`),
      wordCount: post.wordCount,
      isPartOf: { '@type': 'Blog', '@id': `${absoluteUrl(publicPath('blog', lang))}#blog` },
    },
  ];
  if (post.faq.length >= 2) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      inLanguage: IN_LANGUAGE[lang],
      mainEntity: post.faq.map((q) => ({
        '@type': 'Question',
        name: q.question,
        acceptedAnswer: { '@type': 'Answer', text: q.answer },
      })),
    });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}
