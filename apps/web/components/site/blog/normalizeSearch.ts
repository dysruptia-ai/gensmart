/** Texto de búsqueda sin tildes ni mayúsculas (design/web: `norm`). Servidor y cliente. */
export function normalizeSearch(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}
