/**
 * Falla si los diccionarios de un mismo grupo (`i18n/site/*`, `i18n/app/*`) no tienen
 * exactamente las mismas claves. Cada página carga un solo idioma y no hay respaldo a
 * inglés: una clave que falta en un idioma se vería cruda.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'i18n');
const GROUPS = ['site', 'app'];
const LANGS = ['es', 'en'];

function keys(value, prefix, out) {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    for (const [k, v] of Object.entries(value)) keys(v, prefix ? `${prefix}.${k}` : k, out);
  } else {
    out.add(prefix);
  }
  return out;
}

let failed = false;
for (const group of GROUPS) {
  const sets = LANGS.map((lang) =>
    keys(JSON.parse(readFileSync(path.join(ROOT, group, `${lang}.json`), 'utf-8')), '', new Set()),
  );
  LANGS.forEach((lang, i) => {
    const other = LANGS[1 - i];
    const missing = [...sets[1 - i]].filter((k) => !sets[i].has(k));
    if (missing.length) {
      failed = true;
      console.error(`i18n/${group}/${lang}.json: faltan ${missing.length} claves que sí están en ${other}.json`);
      for (const k of missing.slice(0, 20)) console.error(`  - ${k}`);
      if (missing.length > 20) console.error(`  … y ${missing.length - 20} más`);
    }
  });
}

if (failed) process.exit(1);
console.log('i18n: es y en tienen las mismas claves (site y app).');
