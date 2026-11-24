/**
 * Rutas de los cursos de Academy: id y slug por idioma (design/web: `ROUTES[].slug`).
 * Liviano a propósito (lo usan `site-routes`, `proxy.ts` y los enlaces): el contenido de
 * cada curso está en `components/site/academy/academyData.ts`, que solo carga el servidor.
 */
export const ACADEMY_COURSE_IDS = ['primer-agente', 'vender', 'puntaje', 'citas', 'tienda', 'agencias'] as const;

export type AcademyCourseId = (typeof ACADEMY_COURSE_IDS)[number];

export interface AcademyRoute {
  id: AcademyCourseId;
  slug: { es: string; en: string };
}

/** Orden del diseño: es el orden del catálogo y del "Siguiente curso". */
export const ACADEMY_ROUTES: readonly AcademyRoute[] = [
  { id: 'primer-agente', slug: { es: 'tu-primer-agente', en: 'your-first-agent' } },
  { id: 'vender', slug: { es: 'vender-en-conversaciones', en: 'sell-in-conversations' } },
  { id: 'puntaje', slug: { es: 'entender-el-puntaje-de-leads', en: 'understand-lead-score' } },
  { id: 'citas', slug: { es: 'agenda-y-atencion', en: 'booking-and-support' } },
  { id: 'tienda', slug: { es: 'conectar-tu-tienda', en: 'connect-your-store' } },
  { id: 'agencias', slug: { es: 'para-agencias', en: 'for-agencies' } },
];

/** Id de página del registro de rutas para cada curso. */
export type AcademyRouteId = `course-${AcademyCourseId}`;

export function academyRouteId(id: AcademyCourseId): AcademyRouteId {
  return `course-${id}`;
}
