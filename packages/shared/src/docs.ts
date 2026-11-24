/**
 * Base de conocimiento del sitio público: ids de las guías y razones de la valoración
 * "¿Te resultó útil esta guía?". El contenido vive en apps/web (docsData.ts); aquí solo
 * lo que la API necesita para validar POST /api/docs-feedback.
 */
export const DOC_IDS = [
  'que-es-gensmart',
  'primer-agente',
  'conectar-whatsapp',
  'base-de-conocimiento',
  'probar-antes',
  'traspaso',
  'bandeja',
  'crm',
  'agenda',
  'ventana-24-horas',
  'conectar-tienda',
  'integraciones',
] as const;
export type DocId = (typeof DOC_IDS)[number];

export const DOC_FEEDBACK_REASONS = ['inexacto', 'dificil', 'falta', 'irrelevante', 'errores', 'otro'] as const;
export type DocFeedbackReason = (typeof DOC_FEEDBACK_REASONS)[number];

/** Largo máximo del comentario opcional. */
export const DOC_FEEDBACK_COMMENT_MAX = 600;
