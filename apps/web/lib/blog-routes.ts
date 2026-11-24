/**
 * Rutas del blog: las 7 categorías (design/web: `CATS`) y los artículos, por idioma.
 * Liviano a propósito (lo usan `site-routes`, `proxy.ts` y los enlaces del cliente): los
 * artículos salen de `blog-index.generated.json`, que `scripts/blog-index.mjs` genera desde
 * los Markdown de `content/blog/`. El contenido de cada artículo lo lee `lib/blog.ts` (servidor).
 */
import index from './blog-index.generated.json';

export const BLOG_CATEGORY_IDS = [
  'agentes',
  'whatsapp',
  'marketing',
  'crm',
  'atencion',
  'industrias',
  'novedades',
] as const;

export type BlogCategoryId = (typeof BLOG_CATEGORY_IDS)[number];

export interface BlogCategoryRoute {
  id: BlogCategoryId;
  slug: { es: string; en: string };
}

/** Orden del diseño (`CATS`): chips, barra lateral y bloques del índice. */
export const BLOG_CATEGORY_ROUTES: readonly BlogCategoryRoute[] = [
  { id: 'agentes', slug: { es: 'agentes-de-ia', en: 'ai-agents' } },
  { id: 'whatsapp', slug: { es: 'whatsapp-y-canales', en: 'whatsapp-and-channels' } },
  { id: 'marketing', slug: { es: 'marketing', en: 'marketing' } },
  { id: 'crm', slug: { es: 'ventas-y-crm', en: 'sales-and-crm' } },
  { id: 'atencion', slug: { es: 'atencion-al-cliente', en: 'customer-support' } },
  { id: 'industrias', slug: { es: 'por-industria', en: 'by-industry' } },
  { id: 'novedades', slug: { es: 'novedades', en: 'news' } },
];

export interface BlogPostRoute {
  /** `slug[0]` del diseño: une las dos traducciones. */
  id: string;
  category: BlogCategoryId;
  slug: { es: string; en: string };
}

export function isBlogCategoryId(value: string): value is BlogCategoryId {
  return (BLOG_CATEGORY_IDS as readonly string[]).includes(value);
}

export const BLOG_POST_ROUTES: readonly BlogPostRoute[] = index.posts.map((p) => {
  if (!isBlogCategoryId(p.category)) throw new Error(`blog-routes: categoría desconocida ${p.category}`);
  return { id: p.id, category: p.category, slug: { es: p.slug.es, en: p.slug.en } };
});

/** Id de página del registro de rutas para cada categoría y cada artículo. */
export type BlogCategoryRouteId = `blog-cat-${BlogCategoryId}`;
export type BlogPostRouteId = `blog-post-${string}`;

export function blogCategoryRouteId(id: BlogCategoryId): BlogCategoryRouteId {
  return `blog-cat-${id}`;
}

export function blogPostRouteId(id: string): BlogPostRouteId {
  return `blog-post-${id}`;
}
