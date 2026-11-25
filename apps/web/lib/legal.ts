/**
 * Páginas legales desde `content/legal/{es,en}/<slug>.md` (solo servidor: usa `fs`).
 * Los slugs y los ids salen de `lib/legal-routes.ts`; si el frontmatter no coincide,
 * el build falla en vez de publicar una ruta rota.
 */
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { marked } from 'marked';
import { LEGAL_ROUTES, type LegalId, type LegalRoute } from './legal-routes';
import { publicPath, type SiteLanguage } from './site-routes';

const LEGAL_DIR = path.join(process.cwd(), 'content', 'legal');

export interface LegalDoc {
  id: LegalId;
  route: LegalRoute;
  lang: SiteLanguage;
  title: string;
  description: string;
  /** Título para `<title>` cuando `title | GenSmart` no cabe en 60. */
  seoTitle?: string;
  /** `YYYY-MM-DD`. */
  lastUpdated: string;
  /** Cuerpo en HTML, sin el `# Título` del Markdown (el `h1` lo pone la página). */
  html: string;
}

function requireString(data: Record<string, unknown>, key: string, file: string): string {
  const value = data[key];
  if (typeof value !== 'string' || !value) throw new Error(`legal: falta "${key}" en ${file}`);
  return value;
}

/** Los enlaces entre legales del Markdown (`/legal/cookie-policy`) van a la versión del idioma. */
function localizeLegalLinks(html: string, lang: SiteLanguage): string {
  return html.replace(/href="\/legal\/([a-z-]+)"/g, (match, slug: string) => {
    const target = LEGAL_ROUTES.find((l) => l.slug.en === slug || l.slug.es === slug);
    return target ? `href="${publicPath(target.routeId, lang)}"` : match;
  });
}

const cache = new Map<string, LegalDoc>();

export function getLegalDoc(id: LegalId, lang: SiteLanguage): LegalDoc {
  const key = `${lang}:${id}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const route = LEGAL_ROUTES.find((l) => l.id === id);
  if (!route) throw new Error(`legal: id desconocido ${id}`);
  const file = path.join(LEGAL_DIR, lang, `${route.slug[lang]}.md`);
  const { data, content } = matter(fs.readFileSync(file, 'utf-8'));
  const meta = data as Record<string, unknown>;
  if (meta['id'] !== id || meta['slug'] !== route.slug[lang]) {
    throw new Error(`legal: el frontmatter de ${file} no coincide con lib/legal-routes.ts`);
  }
  const body = content.replace(/^\s*# .+\n/, '');
  const lastUpdated = meta['lastUpdated'];
  const doc: LegalDoc = {
    id,
    route,
    lang,
    title: requireString(meta, 'title', file),
    description: requireString(meta, 'description', file),
    seoTitle: typeof meta['seoTitle'] === 'string' ? meta['seoTitle'] : undefined,
    lastUpdated: lastUpdated instanceof Date ? lastUpdated.toISOString().slice(0, 10) : requireString(meta, 'lastUpdated', file),
    html: localizeLegalLinks(marked.parse(body, { async: false }), lang),
  };
  cache.set(key, doc);
  return doc;
}

/** Legal por el slug interno (el inglés), como lo recibe `app/(site)/[lang]/legal/[slug]`. */
export function legalIdByInternalSlug(slug: string): LegalId | null {
  return LEGAL_ROUTES.find((l) => l.slug.en === slug)?.id ?? null;
}
