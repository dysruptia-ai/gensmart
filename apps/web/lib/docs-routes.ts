/**
 * Rutas de las guías de la base de conocimiento: id, grupo y slug por idioma.
 * Liviano a propósito (lo usan `site-routes`, `proxy.ts` y los enlaces): el contenido
 * de cada guía está en `components/site/docs/docsData.ts`, que solo carga el servidor.
 */
import { DOC_IDS, type DocId } from '@gensmart/shared';

export type DocGroupId = 'start' | 'operate' | 'extend';

export interface DocRoute {
  id: DocId;
  group: DocGroupId;
  slug: { es: string; en: string };
}

/** Orden del diseño (`DOCS`). El orden de lectura sale de agrupar por `DOC_GROUP_ORDER`. */
export const DOC_ROUTES: readonly DocRoute[] = [
  { id: 'que-es-gensmart', group: 'start', slug: { es: 'que-es-gensmart', en: 'what-is-gensmart' } },
  { id: 'primer-agente', group: 'start', slug: { es: 'crear-tu-primer-agente', en: 'create-your-first-agent' } },
  { id: 'conectar-whatsapp', group: 'start', slug: { es: 'conectar-whatsapp', en: 'connect-whatsapp' } },
  { id: 'base-de-conocimiento', group: 'start', slug: { es: 'base-de-conocimiento', en: 'knowledge-base' } },
  { id: 'traspaso', group: 'operate', slug: { es: 'traspaso-a-una-persona', en: 'handoff-to-a-person' } },
  { id: 'bandeja', group: 'operate', slug: { es: 'bandeja-unificada', en: 'unified-inbox' } },
  { id: 'crm', group: 'operate', slug: { es: 'crm-y-puntaje-de-leads', en: 'crm-and-lead-score' } },
  { id: 'agenda', group: 'operate', slug: { es: 'agenda-de-citas', en: 'appointment-booking' } },
  { id: 'ventana-24-horas', group: 'extend', slug: { es: 'ventana-de-24-horas', en: '24-hour-window' } },
  { id: 'conectar-tienda', group: 'extend', slug: { es: 'conectar-tu-tienda', en: 'connect-your-store' } },
  { id: 'integraciones', group: 'extend', slug: { es: 'integraciones', en: 'integrations' } },
  {
    id: 'probar-antes',
    group: 'start',
    slug: { es: 'prueba-tu-agente-antes-de-publicarlo', en: 'test-your-agent-before-publishing' },
  },
];

export const DOC_GROUP_ORDER: readonly DocGroupId[] = ['start', 'operate', 'extend'];

/** Id de página del registro de rutas para cada guía. */
export type DocRouteId = `doc-${DocId}`;

export function docRouteId(id: DocId): DocRouteId {
  return `doc-${id}`;
}

/** Orden de lectura (anterior / siguiente): por grupo y, dentro, en el orden del diseño. */
export const DOC_READING_ORDER: readonly DocId[] = DOC_GROUP_ORDER.flatMap((g) =>
  DOC_ROUTES.filter((d) => d.group === g).map((d) => d.id)
);

if (DOC_ROUTES.length !== DOC_IDS.length) {
  throw new Error('docs-routes: DOC_ROUTES y DOC_IDS no coinciden');
}
