/**
 * Artículos del blog: Markdown con frontmatter en `content/blog/{es,en}/<slug>.md`,
 * leídos con `gray-matter` y convertidos con `marked`. Solo servidor (usa `fs`).
 *
 * Sintaxis propia: la nota del diseño (`note`) se escribe como un bloque
 *   :::nota
 *   Texto del consejo.
 *   :::
 * y se renderiza como `<aside class="note">` con la etiqueta "Consejo" / "Tip".
 */
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { Marked, type Token, type TokenizerAndRendererExtension, type Tokens } from 'marked';
import { BLOG_POST_ROUTES, isBlogCategoryId, type BlogCategoryId } from './blog-routes';
import type { SiteLanguage } from './site-routes';

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog');

export interface BlogPostMeta {
  /** `slug[0]` del diseño: une las dos traducciones. */
  id: string;
  slug: string;
  language: SiteLanguage;
  title: string;
  /** El `excerpt` del diseño: lead, meta descripción y resumen de las tarjetas. */
  description: string;
  /** `datePublished` (AAAA-MM-DD). */
  date: string;
  /** `dateModified` (AAAA-MM-DD). */
  updated: string;
  category: BlogCategoryId;
  sub: string;
  /** Minutos de lectura. */
  read: number;
  /** Ruta pública de la portada (1200×900). */
  cover: string;
}

export interface BlogHeading {
  id: string;
  text: string;
}

export interface BlogPost extends BlogPostMeta {
  /** Cuerpo antes y después de la tarjeta "¿Quieres verlo en tu propio negocio?". */
  htmlBefore: string;
  htmlAfter: string;
  headings: BlogHeading[];
  /** Preguntas (`h2` que termina en "?") con su primer párrafo, si hay 2 o más. */
  faq: Array<{ question: string; answer: string }>;
  wordCount: number;
}

/* ---------- Markdown ---------- */

const NOTE_TAG: Record<SiteLanguage, string> = { es: 'Consejo', en: 'Tip' };

/** design/web `slugify`: sin tildes, en minúsculas y hasta 48 caracteres. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };

/** Texto plano de un HTML corto (títulos, párrafos de la FAQ). */
function plain(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&(amp|lt|gt|quot|#39);/g, (m) => ENTITIES[m] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

interface NoteToken extends Tokens.Generic {
  type: 'note';
  raw: string;
  tokens: Token[];
}

function createMarked(lang: SiteLanguage): Marked {
  const note: TokenizerAndRendererExtension = {
    name: 'note',
    level: 'block',
    start(src: string) {
      return src.match(/^:::nota/m)?.index;
    },
    tokenizer(src: string) {
      const match = /^:::nota[ \t]*\n([\s\S]*?)\n:::[ \t]*(?:\n+|$)/.exec(src);
      if (!match) return undefined;
      const token: NoteToken = { type: 'note', raw: match[0], tokens: [] };
      this.lexer.blockTokens(match[1] ?? '', token.tokens);
      return token;
    },
    renderer(token) {
      const inner = this.parser.parse((token as NoteToken).tokens);
      return `<aside class="note"><span class="note-tag">${NOTE_TAG[lang]}</span>${inner}</aside>\n`;
    },
  };
  const marked = new Marked({ gfm: true });
  marked.use({
    extensions: [note],
    renderer: {
      heading({ tokens, depth }) {
        const html = this.parser.parseInline(tokens);
        const id = depth === 2 ? ` id="${slugify(plain(html))}"` : '';
        return `<h${depth}${id}>${html}</h${depth}>\n`;
      },
    },
  });
  return marked;
}

const MARKED: Record<SiteLanguage, Marked> = { es: createMarked('es'), en: createMarked('en') };

/* ---------- Lectura ---------- */

function str(data: Record<string, unknown>, key: string, file: string): string {
  const value = data[key];
  if (typeof value !== 'string' || !value) throw new Error(`blog: ${file} sin "${key}"`);
  return value;
}

function readPost(lang: SiteLanguage, file: string): BlogPost {
  const raw = fs.readFileSync(path.join(BLOG_DIR, lang, file), 'utf-8');
  const { data, content } = matter(raw);
  const category = str(data, 'category', file);
  if (!isBlogCategoryId(category)) throw new Error(`blog: ${file} con categoría desconocida ${category}`);
  if (data['language'] !== lang) throw new Error(`blog: ${file} no está en ${lang}`);
  const read = Number(data['read']);

  const marked = MARKED[lang];
  // Bloques del diseño (p, h2, ul, ol, nota): los tokens de primer nivel sin los espacios
  const blocks = marked.lexer(content).filter((t) => t.type !== 'space');
  // La tarjeta va después del bloque `corte`, con la regla del diseño (`postPage`)
  const corte = Math.min(4, Math.max(2, Math.floor(blocks.length / 2)));
  const render = (tokens: Token[]) => marked.parser(tokens);

  const headings: BlogHeading[] = [];
  const faq: BlogPost['faq'] = [];
  blocks.forEach((token, i) => {
    if (token.type !== 'heading' || (token as Tokens.Heading).depth !== 2) return;
    const text = plain(marked.parseInline((token as Tokens.Heading).text) as string);
    headings.push({ id: slugify(text), text });
    const next = blocks[i + 1];
    if (/\?\s*$/.test(text) && next?.type === 'paragraph') {
      faq.push({ question: text, answer: plain(marked.parseInline((next as Tokens.Paragraph).text) as string) });
    }
  });

  const htmlBefore = render(blocks.slice(0, corte));
  const htmlAfter = render(blocks.slice(corte));
  const wordCount = plain(`${htmlBefore} ${htmlAfter}`).split(' ').filter(Boolean).length;

  return {
    id: str(data, 'id', file),
    slug: file.replace(/\.md$/, ''),
    language: lang,
    title: str(data, 'title', file),
    description: str(data, 'description', file),
    date: str(data, 'date', file),
    updated: str(data, 'updated', file),
    category,
    sub: str(data, 'sub', file),
    read: Number.isFinite(read) ? read : 0,
    cover: str(data, 'cover', file),
    htmlBefore,
    htmlAfter,
    headings,
    faq: faq.length >= 2 ? faq : [],
    wordCount,
  };
}

const cache = new Map<SiteLanguage, BlogPost[]>();

/** Todos los artículos de un idioma, del más nuevo al más viejo. */
export function getAllPosts(lang: SiteLanguage): BlogPost[] {
  const hit = cache.get(lang);
  if (hit) return hit;
  const dir = path.join(BLOG_DIR, lang);
  const posts = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => readPost(lang, f))
    .sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : a.date < b.date ? 1 : -1));
  // El registro de rutas sale de `blog-index.generated.json`: si no coincide con los Markdown, falla
  const indexed = new Map(BLOG_POST_ROUTES.map((r) => [r.id, r]));
  if (indexed.size !== posts.length) {
    throw new Error('blog: lib/blog-index.generated.json está desactualizado (node scripts/blog-index.mjs)');
  }
  for (const p of posts) {
    const route = indexed.get(p.id);
    if (!route || route.slug[lang] !== p.slug || route.category !== p.category) {
      throw new Error(`blog: ${p.id} no coincide con lib/blog-index.generated.json (node scripts/blog-index.mjs)`);
    }
  }
  cache.set(lang, posts);
  return posts;
}

export function getPostById(id: string, lang: SiteLanguage): BlogPost | undefined {
  return getAllPosts(lang).find((p) => p.id === id);
}

/** Artículo por el slug de la ruta interna (`/blog/[post]` usa el slug en inglés). */
export function getPostByInternalSlug(slug: string, lang: SiteLanguage): BlogPost | undefined {
  const route = BLOG_POST_ROUTES.find((r) => r.slug.en === slug);
  return route ? getPostById(route.id, lang) : undefined;
}

export function getPostsByCategory(category: BlogCategoryId, lang: SiteLanguage): BlogPost[] {
  return getAllPosts(lang).filter((p) => p.category === category);
}
