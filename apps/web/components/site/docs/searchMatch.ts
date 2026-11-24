/**
 * Búsqueda de la base de conocimiento: sin tildes ni mayúsculas ("cita" encuentra "Citas").
 * Cada palabra de la consulta debe aparecer en el título, el resumen, el grupo o un `h2`.
 */
export interface SearchEntry {
  href: string;
  title: string;
  summary: string;
  group: string;
  headings: string[];
}

export function fold(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function searchDocs(entries: readonly SearchEntry[], query: string): SearchEntry[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...entries];
  const scored: { entry: SearchEntry; score: number; order: number }[] = [];
  entries.forEach((entry, order) => {
    const title = fold(entry.title);
    const summary = fold(entry.summary);
    const group = fold(entry.group);
    const headings = entry.headings.map(fold);
    let score = 0;
    for (const word of words) {
      const s =
        (title.includes(word) ? 4 : 0) +
        (headings.some((h) => h.includes(word)) ? 2 : 0) +
        (summary.includes(word) ? 1 : 0) +
        (group.includes(word) ? 1 : 0);
      if (s === 0) return;
      score += s;
    }
    scored.push({ entry, score, order });
  });
  return scored.sort((a, b) => b.score - a.score || a.order - b.order).map((x) => x.entry);
}

/** Partes del texto con las coincidencias marcadas (para `<mark>`), comparando sin tildes. */
export function highlight(text: string, query: string): { text: string; hit: boolean }[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [{ text, hit: false }];
  // `fold` conserva el largo en el alfabeto latino: los índices sirven sobre el texto original
  const folded = fold(text);
  if (folded.length !== text.length) return [{ text, hit: false }];
  const marks = new Array<boolean>(text.length).fill(false);
  for (const word of words) {
    let from = folded.indexOf(word);
    while (from !== -1) {
      for (let i = from; i < from + word.length; i++) marks[i] = true;
      from = folded.indexOf(word, from + word.length);
    }
  }
  const parts: { text: string; hit: boolean }[] = [];
  for (let i = 0; i < text.length; i++) {
    const last = parts[parts.length - 1];
    if (last && last.hit === marks[i]) last.text += text[i];
    else parts.push({ text: text[i] ?? '', hit: Boolean(marks[i]) });
  }
  return parts;
}
