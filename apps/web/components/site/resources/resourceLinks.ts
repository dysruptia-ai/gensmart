/**
 * Enlaces de Recursos a secciones que todavía no están migradas: base de conocimiento
 * (web-30), Academy (web-31) y los artículos nuevos del blog (web-32).
 * Los slugs y títulos son los del diseño (design/web: `DOCS`, `ROUTES`, `RUTA_BLOG`),
 * para reutilizarlos al migrar cada sección. Hoy los helpers devuelven `null`
 * (enlace pendiente: se ve, no navega); cada prompt futuro los conecta con su ruta.
 * Sin `'use client'`: el JSON-LD se arma en el servidor con esto.
 */
import type { SiteHref } from '@/lib/site-links';
import type { SiteLanguage } from '@/lib/site-routes';

type ByLang = Record<SiteLanguage, string>;

export interface ResourceEntry {
  slug: ByLang;
  title: ByLang;
}

export type DocGroup = 'start' | 'operate' | 'extend';

export interface DocGuide extends ResourceEntry {
  group: DocGroup;
}

export interface AcademyCourse extends ResourceEntry {
  /** "Al terminar…" */
  goal: ByLang;
}

export interface BlogPost extends ResourceEntry {
  category: ByLang;
}

export const DOC_GROUPS: readonly DocGroup[] = ['start', 'operate', 'extend'];

/** Las 12 guías de la base de conocimiento, en el orden del diseño. */
export const DOC_GUIDES: readonly DocGuide[] = [
  { group: 'start', slug: { es: 'que-es-gensmart', en: 'what-is-gensmart' }, title: { es: 'Qué es GenSmart', en: 'What is GenSmart' } },
  { group: 'start', slug: { es: 'crear-tu-primer-agente', en: 'create-your-first-agent' }, title: { es: 'Crea tu primer agente', en: 'Create your first agent' } },
  { group: 'start', slug: { es: 'conectar-whatsapp', en: 'connect-whatsapp' }, title: { es: 'Conecta tu número de WhatsApp Business', en: 'Connect your WhatsApp Business number' } },
  { group: 'start', slug: { es: 'base-de-conocimiento', en: 'knowledge-base' }, title: { es: 'Base de conocimiento: lo que sabe tu agente', en: 'Knowledge base: what your agent knows' } },
  { group: 'start', slug: { es: 'prueba-tu-agente-antes-de-publicarlo', en: 'test-your-agent-before-publishing' }, title: { es: 'Prueba tu agente antes de publicarlo', en: 'Test your agent before publishing' } },
  { group: 'operate', slug: { es: 'traspaso-a-una-persona', en: 'handoff-to-a-person' }, title: { es: 'Traspaso a una persona', en: 'Handoff to a person' } },
  { group: 'operate', slug: { es: 'bandeja-unificada', en: 'unified-inbox' }, title: { es: 'Bandeja unificada', en: 'Unified inbox' } },
  { group: 'operate', slug: { es: 'crm-y-puntaje-de-leads', en: 'crm-and-lead-score' }, title: { es: 'CRM y puntaje de leads', en: 'CRM and lead score' } },
  { group: 'operate', slug: { es: 'agenda-de-citas', en: 'appointment-booking' }, title: { es: 'Agenda de citas', en: 'Appointment booking' } },
  { group: 'extend', slug: { es: 'ventana-de-24-horas', en: '24-hour-window' }, title: { es: 'La ventana de 24 horas de WhatsApp', en: 'The WhatsApp 24-hour window' } },
  { group: 'extend', slug: { es: 'conectar-tu-tienda', en: 'connect-your-store' }, title: { es: 'Conecta tu tienda con tu agente', en: 'Connect your store to your agent' } },
  { group: 'extend', slug: { es: 'integraciones', en: 'integrations' }, title: { es: 'Integraciones y herramientas externas', en: 'Integrations and external tools' } },
];

/** Los 6 cursos de Academy. */
export const ACADEMY_COURSES: readonly AcademyCourse[] = [
  {
    slug: { es: 'tu-primer-agente', en: 'your-first-agent' },
    title: { es: 'Tu primer agente, de cero a activo', en: 'Your first agent, from zero to live' },
    goal: {
      es: 'Al terminar tienes un agente probado, conectado a WhatsApp y con reglas de traspaso.',
      en: 'By the end you have a tested agent, connected to WhatsApp and with handoff rules.',
    },
  },
  {
    slug: { es: 'vender-en-conversaciones', en: 'sell-in-conversations' },
    title: { es: 'Vender en conversaciones', en: 'Sell in conversations' },
    goal: {
      es: 'Al terminar sabes a quién responder primero y si tu agente de ventas está funcionando.',
      en: 'By the end you know who to answer first and whether your sales agent is working.',
    },
  },
  {
    slug: { es: 'entender-el-puntaje-de-leads', en: 'understand-lead-score' },
    title: { es: 'Entender el puntaje de leads', en: 'Understand the lead score' },
    goal: {
      es: 'Al terminar sabes qué significa cada puntaje, cómo se mueve un contacto en el embudo y a quién escribirle primero.',
      en: 'By the end you know what each score means, how a contact moves through the pipeline and who to write to first.',
    },
  },
  {
    slug: { es: 'agenda-y-atencion', en: 'booking-and-support' },
    title: { es: 'Agenda y atención al cliente', en: 'Booking and customer support' },
    goal: {
      es: 'Al terminar tienes un flujo de citas con reglas claras y un traspaso que no obliga al cliente a repetir todo.',
      en: 'By the end you have a booking flow with clear rules and a handoff that does not make the customer repeat everything.',
    },
  },
  {
    slug: { es: 'conectar-tu-tienda', en: 'connect-your-store' },
    title: { es: 'Conectar tu tienda con tu agente', en: 'Connect your store to your agent' },
    goal: {
      es: 'Al terminar tu agente busca productos, consulta envíos y crea pedidos con link de pago de tu tienda.',
      en: "By the end your agent searches products, checks shipping and creates orders with your store's payment link.",
    },
  },
  {
    slug: { es: 'para-agencias', en: 'for-agencies' },
    title: { es: 'Para agencias que implementan', en: 'For agencies that implement' },
    goal: {
      es: 'Al terminar tienes un proceso repetible de implementación y sabes cómo funciona el programa de socios.',
      en: 'By the end you have a repeatable implementation process and know how the partner program works.',
    },
  },
];

const AI_AGENTS: ByLang = { es: 'Agentes de IA', en: 'AI agents' };

/** Los 3 artículos nuevos del blog que lista Recursos (conocimiento, traspaso, pruebas). */
export const RESOURCE_BLOG_POSTS: readonly BlogPost[] = [
  {
    category: AI_AGENTS,
    slug: { es: 'como-escribir-la-base-de-conocimiento-de-tu-agente', en: 'how-to-write-your-agents-knowledge-base' },
    title: {
      es: 'Cómo escribir la base de conocimiento de tu agente para que responda con datos, no con rodeos',
      en: "How to write your agent's knowledge base so it answers with facts, not detours",
    },
  },
  {
    category: AI_AGENTS,
    slug: { es: 'cuando-un-agente-de-ia-debe-pasar-a-un-humano', en: 'when-an-ai-agent-should-hand-off-to-a-human' },
    title: {
      es: 'Cuándo un agente de IA debe pasar la conversación a una persona',
      en: 'When an AI agent should hand the conversation to a person',
    },
  },
  {
    category: AI_AGENTS,
    slug: { es: 'checklist-antes-de-poner-tu-agente-en-vivo', en: 'checklist-before-putting-your-agent-live' },
    title: { es: 'Checklist antes de poner tu agente en vivo', en: 'Checklist before putting your agent live' },
  },
];

/* Pendientes: devuelven `null` hasta migrar cada sección. Reciben slug e idioma para
   que conectarlos sea cambiar solo el cuerpo. */
/* eslint-disable @typescript-eslint/no-unused-vars -- parámetros reservados para web-30 a web-32 */
/** Guía de la base de conocimiento (web-30). */
export function docHref(_slug: string, _lang: SiteLanguage): SiteHref | null {
  return null;
}

/** Curso de Academy (web-31). */
export function academyHref(_slug: string, _lang: SiteLanguage): SiteHref | null {
  return null;
}

/** Artículo nuevo del blog (web-32). */
export function blogPostHref(_slug: string, _lang: SiteLanguage): SiteHref | null {
  return null;
}
/* eslint-enable @typescript-eslint/no-unused-vars */
