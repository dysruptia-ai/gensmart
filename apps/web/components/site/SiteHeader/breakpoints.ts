/**
 * Ancho mínimo (px) para mostrar el menú de escritorio.
 * Por debajo se usa el botón de menú y el panel móvil.
 *
 * Origen: con los textos en español (los más largos), logo + 5 menús + zona derecha
 * miden ~1127 px (caben en los 1136 px del contenedor de 1200); sumando 2 × 32 px de
 * gutter y 16 px de holgura da ~1207 px, redondeado al siguiente múltiplo de 20 → 1220.
 * SiteHeader.module.css repite este valor en sus @media (no pueden leer constantes TS):
 * si cambia aquí, cámbialo allí.
 */
export const DESKTOP_NAV_MIN_WIDTH = 1220;
