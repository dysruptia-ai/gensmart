/**
 * Genera `lib/blog-index.generated.json` desde los Markdown de `content/blog/{es,en}`:
 * el id de cada artículo, su categoría y su slug por idioma. Lo necesitan el registro de
 * rutas, `proxy.ts` y los enlaces del cliente, que no pueden leer archivos.
 * Corre antes de `dev` y `build`; `lib/blog.ts` falla el build si el JSON quedó viejo.
 * Uso: `node scripts/blog-index.mjs` (o `--check` para solo comprobar).
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'content', 'blog');
const OUT = path.join(ROOT, 'lib', 'blog-index.generated.json');

const byId = new Map();
for (const lang of ['es', 'en']) {
  for (const file of readdirSync(path.join(DIR, lang)).filter((f) => f.endsWith('.md')).sort()) {
    const { data } = matter(readFileSync(path.join(DIR, lang, file), 'utf8'));
    const id = String(data.id);
    const entry = byId.get(id) ?? { id, category: String(data.category), slug: {} };
    if (entry.category !== String(data.category)) throw new Error(`blog-index: ${id} cambia de categoría entre idiomas`);
    entry.slug[lang] = file.replace(/\.md$/, '');
    byId.set(id, entry);
  }
}
const posts = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
for (const p of posts) {
  if (!p.slug.es || !p.slug.en) throw new Error(`blog-index: ${p.id} no tiene las dos traducciones`);
}
const json = `${JSON.stringify({ posts }, null, 2)}\n`;
if (process.argv.includes('--check')) {
  if (readFileSync(OUT, 'utf8') !== json) {
    console.error('blog-index: lib/blog-index.generated.json está desactualizado. Corre `node scripts/blog-index.mjs`.');
    process.exit(1);
  }
} else {
  writeFileSync(OUT, json);
  console.log(`blog-index: ${posts.length} artículos`);
}
