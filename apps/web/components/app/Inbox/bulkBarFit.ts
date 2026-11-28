/**
 * Bandeja (web-44b, web-45): cuánto texto lleva la barra del lote en escritorio.
 * Borrar y × son siempre íconos; Asignar, Cerrar y Etiquetar van solo con su texto (sin ícono)
 * mientras quepan.
 *   0 = las acciones con texto · 1 = todo con íconos.
 */
export interface BarMeasure {
  /** Ancho interior disponible de la barra (sin el padding). */
  width: number;
  /** "N seleccionadas". */
  countWidth: number;
  /** Ancho con texto de cada acción que puede llevarlo (medido una vez con texto). */
  textWidths: number[];
  /** Botones que son siempre íconos (Borrar, ×). */
  fixedIcons: number;
  iconWidth: number;
  gap: number;
}

export function bulkBarLevel(m: BarMeasure): 0 | 1 {
  const items = 1 + m.textWidths.length + m.fixedIcons;
  const gaps = Math.max(0, items - 1) * m.gap;
  const withText = m.countWidth + m.textWidths.reduce((a, b) => a + b, 0) + m.fixedIcons * m.iconWidth + gaps;
  return withText <= m.width ? 0 : 1;
}
