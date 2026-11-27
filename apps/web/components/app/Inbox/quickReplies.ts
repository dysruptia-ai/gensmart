/**
 * Respuestas rápidas (web-43): variables y el menú de "/". Funciones puras, con su test.
 *
 * Variables: {nombre} (primer nombre del contacto) y {agente} (primer nombre de quien escribe).
 * También se aceptan {name} y {agent} como alias, para quien use la interfaz en inglés.
 */

export interface QuickReply {
  id: string;
  shortcut: string;
  body: string;
  useCount: number;
  lastUsedAt: string | null;
}

export interface ReplyVariables {
  contactName?: string | null;
  agentName?: string | null;
  /** Idioma para la mayúscula al inicio de una línea (toLocaleUpperCase). */
  language?: string;
}

const PHONE_LIKE = /^[+\d\s()-]+$/;

/** Primera palabra del nombre; nada si está vacío o parece un teléfono. */
export function firstName(name: string | null | undefined): string | null {
  const clean = (name ?? '').trim();
  if (!clean || PHONE_LIKE.test(clean)) return null;
  return clean.split(/\s+/)[0] ?? null;
}

const VARIABLE_RE = /\{(nombre|agente|name|agent)\}/giu;

function variableValue(key: string, vars: ReplyVariables): string | null {
  const k = key.toLowerCase();
  if (k === 'nombre' || k === 'name') return firstName(vars.contactName);
  return firstName(vars.agentName);
}

/** Un trozo de la vista previa: texto normal o el valor que puso una variable. */
export interface ReplyPart {
  text: string;
  variable?: 'contact' | 'agent';
}

/**
 * Cambia las variables por su valor. Sin dato, la variable se quita y se arregla el texto: no quedan
 * dobles espacios ni un espacio antes de la puntuación. Una variable desconocida queda tal cual.
 */
export function applyReplyVariablesParts(body: string, vars: ReplyVariables): ReplyPart[] {
  const parts: ReplyPart[] = [];
  let last = 0;
  let removed = false;
  for (const match of body.matchAll(VARIABLE_RE)) {
    const index = match.index ?? 0;
    if (index > last) parts.push({ text: body.slice(last, index) });
    const value = variableValue(match[1]!, vars);
    if (value) {
      const k = match[1]!.toLowerCase();
      parts.push({ text: value, variable: k === 'nombre' || k === 'name' ? 'contact' : 'agent' });
    } else {
      // Marca del hueco para limpiarlo después
      parts.push({ text: '\u0000' });
      removed = true;
    }
    last = index + match[0].length;
  }
  if (last < body.length) parts.push({ text: body.slice(last) });
  if (!removed) return parts;
  return tidyParts(parts, vars.language);
}

/** Limpia los huecos de las variables vacías sin tocar el resto del texto. */
function tidyParts(parts: ReplyPart[], language?: string): ReplyPart[] {
  // Se trabaja sobre el texto plano de los trozos normales; los valores de variables no se tocan.
  const joined = parts.map((p) => (p.variable ? '\u0001'.repeat(p.text.length) : p.text)).join('');
  // Líneas que empezaban con una variable sin dato: la primera letra que queda va en mayúscula
  // ("{nombre}, te escribo" → "Te escribo"). Los saltos de línea no se tocan, así que el índice se conserva.
  const startHoles = new Set(
    joined
      .split('\n')
      .map((line, i) => (/^[ \t]*\u0000/.test(line) ? i : -1))
      .filter((i) => i >= 0),
  );
  const tidied = joined
    // "meses, {nombre}." sin dato: no queda la coma suelta antes del punto
    .replace(/,[ \t]*\u0000(?=[ \t]*[.!?;:…])/g, '\u0000')
    // espacios (no saltos de línea) alrededor del hueco se reducen a uno
    .replace(/[ \t]*\u0000[ \t]*/g, (m) => (m.trim() === '\u0000' && /[ \t]/.test(m) ? ' ' : ''))
    .replace(/\u0000/g, '')
    // sin espacio antes de la puntuación
    .replace(/[ \t]+([,.;:!?…)])/g, '$1')
    // sin espacio después de ¿ ¡ (
    .replace(/([¿¡(])[ \t]+/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    // al inicio de una línea, sin espacio ni coma suelta
    .replace(/(^|\n)[ \t]*[,;:]?[ \t]*/g, '$1')
    .replace(/[ \t]+(\n|$)/g, '$1');
  const cleaned = startHoles.size
    ? tidied
        .split('\n')
        .map((line, i) =>
          startHoles.has(i) ? line.replace(/^([¿¡(«"']*)(\p{Ll})/u, (_m, lead: string, ch: string) => lead + ch.toLocaleUpperCase(language === 'es' || language === 'en' ? language : undefined)) : line,
        )
        .join('\n')
    : tidied;
  // Se vuelven a armar los trozos: los \u0001 son los valores, en el mismo orden
  const values = parts.filter((p) => p.variable);
  const out: ReplyPart[] = [];
  let buf = '';
  let v = 0;
  for (let i = 0; i < cleaned.length; ) {
    if (cleaned[i] === '\u0001') {
      if (buf) out.push({ text: buf });
      buf = '';
      const value = values[v++]!;
      out.push(value);
      i += value.text.length;
    } else {
      buf += cleaned[i];
      i++;
    }
  }
  if (buf) out.push({ text: buf });
  return out;
}

export function applyReplyVariables(body: string, vars: ReplyVariables): string {
  return applyReplyVariablesParts(body, vars)
    .map((p) => p.text)
    .join('');
}

// ── menú de "/" ──────────────────────────────────────────────────────────────

/** Sin tildes y en minúsculas, para comparar. */
export function fold(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

export interface SlashToken {
  /** Dónde está la "/" en el texto. */
  start: number;
  /** Lo escrito entre la "/" y el cursor. */
  query: string;
}

/**
 * La ficha "/filtro" que termina en el cursor, si la hay. La "/" tiene que estar al inicio del cuadro
 * o después de un espacio o salto de línea (así "https://…" no abre el menú). El filtro no lleva espacios.
 */
export function findSlashToken(text: string, caret: number): SlashToken | null {
  const before = text.slice(0, caret);
  const match = /(^|\s)\/([^\s/]*)$/u.exec(before);
  if (!match) return null;
  const start = before.length - match[2]!.length - 1;
  return { start, query: match[2]! };
}

export interface MenuMatch {
  reply: QuickReply;
  /** Dónde coincide el filtro dentro del atajo (para resaltarlo), o null si coincidió por el texto. */
  shortcutRange: [number, number] | null;
}

export const MENU_MAX = 8;

/** Coincidencias por atajo primero y por texto después; dentro de cada grupo, por usos. Máximo 8. */
export function filterQuickReplies(replies: readonly QuickReply[], query: string, max = MENU_MAX): MenuMatch[] {
  const q = fold(query);
  const byUse = (a: MenuMatch, b: MenuMatch) => b.reply.useCount - a.reply.useCount || a.reply.shortcut.localeCompare(b.reply.shortcut);
  const shortcut: MenuMatch[] = [];
  const text: MenuMatch[] = [];
  for (const reply of replies) {
    const s = fold(reply.shortcut);
    const at = s.indexOf(q);
    if (at >= 0) shortcut.push({ reply, shortcutRange: q ? [at, at + q.length] : null });
    else if (q && fold(reply.body).includes(q)) text.push({ reply, shortcutRange: null });
  }
  return [...shortcut.sort(byUse), ...text.sort(byUse)].slice(0, max);
}

/** Reemplaza la ficha "/filtro" por el texto. Devuelve el texto nuevo y dónde queda el cursor. */
export function insertReply(text: string, token: SlashToken, caret: number, body: string): { text: string; caret: number } {
  const next = text.slice(0, token.start) + body + text.slice(caret);
  return { text: next, caret: token.start + body.length };
}

/** Las 3 más usadas (los chips del compositor). */
export function topReplies(replies: readonly QuickReply[], n = 3): QuickReply[] {
  return [...replies].sort((a, b) => b.useCount - a.useCount || a.shortcut.localeCompare(b.shortcut)).slice(0, n);
}
