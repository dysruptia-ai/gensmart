/**
 * Bandeja (web-44): resaltado de la búsqueda. Sin distinguir mayúsculas ni tildes (como la API, que
 * compara con unaccent + lower), pero los segmentos se cortan sobre el texto ORIGINAL, con sus tildes.
 * Se pinta como texto (nunca con dangerouslySetInnerHTML).
 */

export interface MatchSegment {
  text: string;
  match: boolean;
}

/** Texto plegado (sin marcas y en minúsculas) y, por cada carácter plegado, su posición en el original. */
function foldWithMap(text: string): { folded: string; map: number[] } {
  let folded = '';
  const map: number[] = [];
  let i = 0;
  for (const ch of text) {
    const f = ch.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    for (let k = 0; k < f.length; k++) map.push(i);
    folded += f;
    i += ch.length;
  }
  map.push(text.length);
  return { folded, map };
}

export function foldText(text: string): string {
  return foldWithMap(text).folded;
}

/** ¿El texto contiene la búsqueda (sin mayúsculas ni tildes)? */
export function matchesQuery(text: string | null | undefined, query: string): boolean {
  const q = foldText(query.trim());
  return !!q && !!text && foldText(text).includes(q);
}

/** Rangos [inicio, fin) en el texto original de cada coincidencia. */
function matchRanges(text: string, query: string): Array<[number, number]> {
  const q = foldText(query.trim());
  if (!q) return [];
  const { folded, map } = foldWithMap(text);
  const out: Array<[number, number]> = [];
  let from = 0;
  for (;;) {
    const at = folded.indexOf(q, from);
    if (at < 0) break;
    const start = map[at]!;
    // el final es donde empieza el carácter original siguiente (incluye las marcas combinadas)
    out.push([start, map[at + q.length]!]);
    from = at + q.length;
  }
  return out;
}

export interface HighlightOptions {
  /** Largo del fragmento cuando el texto es más largo (por defecto 120). */
  maxLength?: number;
}

/**
 * Segmentos `{ text, match }` del texto con la búsqueda resaltada. Si el texto es largo, devuelve un
 * fragmento de unos `maxLength` caracteres alrededor de la primera coincidencia, con "…" donde se cortó
 * y sin cortar palabras si se puede. Sin coincidencia: el comienzo del texto (recortado igual).
 */
export function highlightMatch(text: string, query: string, opts: HighlightOptions = {}): MatchSegment[] {
  const max = opts.maxLength ?? 120;
  const ranges = matchRanges(text, query);
  let start = 0;
  let end = text.length;
  if (text.length > max) {
    const first = ranges[0];
    if (first) {
      const lead = Math.floor((max - (first[1] - first[0])) / 3);
      start = Math.max(0, first[0] - Math.max(0, lead));
      end = Math.min(text.length, start + max);
      start = Math.max(0, end - max);
    } else {
      end = max;
    }
    // No cortar palabras: avanza al siguiente espacio (o retrocede al anterior) si está cerca
    if (start > 0) {
      const sp = text.indexOf(' ', start);
      if (sp >= 0 && sp - start <= 15 && (!first || sp < first[0])) start = sp + 1;
    }
    if (end < text.length) {
      const sp = text.lastIndexOf(' ', end);
      if (sp > start && end - sp <= 15 && (!first || sp >= first[1])) end = sp;
    }
  }

  const segments: MatchSegment[] = [];
  const push = (t: string, match: boolean) => {
    if (!t) return;
    const prev = segments[segments.length - 1];
    if (prev && prev.match === match) prev.text += t;
    else segments.push({ text: t, match });
  };
  if (start > 0) push('…', false);
  let pos = start;
  for (const [a, b] of ranges) {
    if (b <= start || a >= end) continue;
    const s = Math.max(a, start);
    const e = Math.min(b, end);
    push(text.slice(pos, s), false);
    push(text.slice(s, e), true);
    pos = e;
  }
  push(text.slice(pos, end), false);
  if (end < text.length) push('…', false);
  return segments;
}
