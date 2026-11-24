/**
 * Datos de Academy (design/web: `ROUTES` de `docs.mjs` y `TYPES`, `LEVELS`, `PRODUCTS`,
 * `AUDIENCES` y `META` de `academy.mjs`). Cada lección es una guía, un artículo del blog o
 * una página que ya existe: aquí solo van su título y su referencia. Los minutos y el resumen
 * salen de `docsData.ts` (guías) y de `ACADEMY_POSTS` (artículos, de `design/web/posts*.mjs`).
 * Solo lo carga el servidor: las páginas pasan a los componentes de cliente lo que necesitan.
 */
import type { DocId } from '@gensmart/shared';
import type { AcademyCourseId } from '@/lib/academy-routes';
import type { SiteLanguage } from '@/lib/site-routes';

export type ByLang = Record<SiteLanguage, string>;

export type AcademyTypeId = 'curso' | 'tutorial' | 'caso' | 'webinar';
export type AcademyLevelId = 'inicial' | 'intermedio' | 'avanzado';
export type AcademyProductId = 'agentes' | 'whatsapp' | 'bandeja' | 'crm' | 'agenda' | 'integraciones' | 'socios';
export type AcademyAudienceId = 'tiendas' | 'comerciales' | 'servicios' | 'soporte' | 'agencias';
/** Artículos del blog que son lecciones: `ref` es el slug en inglés (`slug[1]`), como el diseño. */
export type AcademyPostRef =
  | 'how-to-measure-whether-your-sales-agent-works'
  | 'questions-to-qualify-a-prospect'
  | 'booking-appointments-on-whatsapp-with-an-ai-agent';
/** Páginas que son lecciones: claves del registro de rutas. */
export type AcademyPageRef = 'partners' | 'partnersDirectory';

export type AcademyLesson =
  | { title: ByLang; kind: 'doc'; ref: DocId }
  | { title: ByLang; kind: 'post'; ref: AcademyPostRef }
  | { title: ByLang; kind: 'page'; ref: AcademyPageRef };

export interface AcademyTaxon<Id extends string> {
  id: Id;
  name: ByLang;
}

export interface AcademyDescribed<Id extends string> extends AcademyTaxon<Id> {
  description: ByLang;
}

export interface AcademyCourseData {
  id: AcademyCourseId;
  slug: ByLang;
  title: ByLang;
  /** "Para quien…" (el diseño lo trae; hoy no se muestra). */
  for: ByLang;
  /** "Al terminar…": lead del curso y descripción de la página. */
  goal: ByLang;
  type: AcademyTypeId;
  level: AcademyLevelId;
  products: readonly AcademyProductId[];
  /** Vacío = para todos (entra en cualquier filtro de audiencia). */
  audience: readonly AcademyAudienceId[];
  /** El curso de "¿No sabes por dónde empezar?". */
  start?: boolean;
  lessons: readonly AcademyLesson[];
}

export interface AcademyPostData {
  ref: AcademyPostRef;
  slug: ByLang;
  title: ByLang;
  excerpt: ByLang;
  /** Minutos de lectura (`read`). */
  minutes: number;
}

export const ACADEMY_TYPES: readonly AcademyTaxon<AcademyTypeId>[] = [
  { id: 'curso', name: { es: "Curso", en: "Course" } },
  { id: 'tutorial', name: { es: "Tutorial", en: "Tutorial" } },
  { id: 'caso', name: { es: "Caso de uso", en: "Use case" } },
  { id: 'webinar', name: { es: "Webinar", en: "Webinar" } },
];

export const ACADEMY_LEVELS: readonly AcademyTaxon<AcademyLevelId>[] = [
  { id: 'inicial', name: { es: "Inicial", en: "Beginner" } },
  { id: 'intermedio', name: { es: "Intermedio", en: "Intermediate" } },
  { id: 'avanzado', name: { es: "Avanzado", en: "Advanced" } },
];

export const ACADEMY_PRODUCTS: readonly AcademyDescribed<AcademyProductId>[] = [
  { id: 'agentes', name: { es: "Agentes", en: "Agents" }, description: { es: "Crea un agente con la información de tu negocio, defínele reglas y pruébalo antes de publicarlo.", en: "Build an agent with your business information, give it rules and test it before going live." } },
  { id: 'whatsapp', name: { es: "WhatsApp", en: "WhatsApp" }, description: { es: "Conecta tu número de WhatsApp Business y entiende cómo funciona la ventana de 24 horas.", en: "Connect your WhatsApp Business number and understand how the 24-hour window works." } },
  { id: 'bandeja', name: { es: "Bandeja", en: "Inbox" }, description: { es: "Todas tus conversaciones en un solo lugar, con la opción de tomar el control cuando haga falta.", en: "All your conversations in one place, with the option to take over when needed." } },
  { id: 'crm', name: { es: "CRM", en: "CRM" }, description: { es: "Contactos, embudo y puntaje de leads para saber a quién responder primero.", en: "Contacts, pipeline and lead score so you know who to answer first." } },
  { id: 'agenda', name: { es: "Agenda", en: "Scheduling" }, description: { es: "Citas que el agente agenda y confirma con las reglas de tu calendario.", en: "Appointments the agent books and confirms with your calendar rules." } },
  { id: 'integraciones', name: { es: "Integraciones", en: "Integrations" }, description: { es: "Conecta tu tienda y tus herramientas externas con tu agente.", en: "Connect your store and external tools to your agent." } },
  { id: 'socios', name: { es: "Programa de socios", en: "Partner program" }, description: { es: "Implementa agentes para tus clientes y conoce cómo funciona el programa.", en: "Implement agents for your customers and learn how the program works." } },
];

export const ACADEMY_AUDIENCES: readonly AcademyDescribed<AcademyAudienceId>[] = [
  { id: 'tiendas', name: { es: "Tiendas", en: "Stores" }, description: { es: "Atiende y vende por chat sin perder pedidos.", en: "Answer and sell by chat without losing orders." } },
  { id: 'comerciales', name: { es: "Equipos comerciales", en: "Sales teams" }, description: { es: "Prioriza leads y mide si tu agente vende.", en: "Prioritize leads and measure whether your agent sells." } },
  { id: 'servicios', name: { es: "Clínicas y servicios", en: "Clinics and services" }, description: { es: "Agenda citas con reglas claras.", en: "Book appointments with clear rules." } },
  { id: 'soporte', name: { es: "Equipos de soporte", en: "Support teams" }, description: { es: "Responde y pasa a una persona sin que el cliente repita todo.", en: "Answer and hand off to a person without the customer repeating everything." } },
  { id: 'agencias', name: { es: "Agencias", en: "Agencies" }, description: { es: "Implementa agentes para tus clientes.", en: "Implement agents for your customers." } },
];

/** Los 6 cursos, en el orden del diseño. */
export const ACADEMY_COURSES_DATA: readonly AcademyCourseData[] = [
  {
    id: 'primer-agente',
    slug: { es: "tu-primer-agente", en: "your-first-agent" },
    title: { es: "Tu primer agente, de cero a activo", en: "Your first agent, from zero to live" },
    for: { es: "Para quien aún no ha creado ninguno.", en: "For anyone who has not created one yet." },
    goal: { es: "Al terminar tienes un agente probado, conectado a WhatsApp y con reglas de traspaso.", en: "By the end you have a tested agent, connected to WhatsApp and with handoff rules." },
    type: 'curso',
    level: 'inicial',
    products: ['agentes', 'whatsapp'],
    audience: [],
    start: true,
    lessons: [
      { title: { es: "Qué es GenSmart y qué hace tu agente", en: "What GenSmart is and what your agent does" }, kind: 'doc', ref: 'que-es-gensmart' },
      { title: { es: "Crea el agente", en: "Create the agent" }, kind: 'doc', ref: 'primer-agente' },
      { title: { es: "Conecta WhatsApp", en: "Connect WhatsApp" }, kind: 'doc', ref: 'conectar-whatsapp' },
      { title: { es: "Cárgale lo que sabe tu negocio", en: "Load what your business knows" }, kind: 'doc', ref: 'base-de-conocimiento' },
      { title: { es: "Define cuándo pasa a una persona", en: "Define when it hands off to a person" }, kind: 'doc', ref: 'traspaso' },
      { title: { es: "Pruébalo antes de salir al aire", en: "Test it before going live" }, kind: 'doc', ref: 'probar-antes' },
    ],
  },
  {
    id: 'vender',
    slug: { es: "vender-en-conversaciones", en: "sell-in-conversations" },
    title: { es: "Vender en conversaciones", en: "Sell in conversations" },
    for: { es: "Para equipos comerciales y tiendas.", en: "For sales teams and stores." },
    goal: { es: "Al terminar sabes a quién responder primero y si tu agente de ventas está funcionando.", en: "By the end you know who to answer first and whether your sales agent is working." },
    type: 'curso',
    level: 'intermedio',
    products: ['bandeja', 'crm'],
    audience: ['tiendas', 'comerciales'],
    lessons: [
      { title: { es: "Lee la bandeja", en: "Read the inbox" }, kind: 'doc', ref: 'bandeja' },
      { title: { es: "CRM, embudo y puntaje", en: "CRM, pipeline and score" }, kind: 'doc', ref: 'crm' },
      { title: { es: "La ventana de 24 horas", en: "The 24-hour window" }, kind: 'doc', ref: 'ventana-24-horas' },
      { title: { es: "Mide si funciona", en: "Measure whether it works" }, kind: 'post', ref: 'how-to-measure-whether-your-sales-agent-works' },
    ],
  },
  {
    id: 'puntaje',
    slug: { es: "entender-el-puntaje-de-leads", en: "understand-lead-score" },
    title: { es: "Entender el puntaje de leads", en: "Understand the lead score" },
    for: { es: "Para equipos comerciales y tiendas que ya reciben conversaciones.", en: "For sales teams and stores that already receive conversations." },
    goal: { es: "Al terminar sabes qué significa cada puntaje, cómo se mueve un contacto en el embudo y a quién escribirle primero.", en: "By the end you know what each score means, how a contact moves through the pipeline and who to write to first." },
    type: 'curso',
    level: 'intermedio',
    products: ['crm', 'bandeja'],
    audience: ['comerciales', 'tiendas'],
    lessons: [
      { title: { es: "Cómo se calcula el puntaje y qué hacer con él", en: "How the score is calculated and what to do with it" }, kind: 'doc', ref: 'crm' },
      { title: { es: "Lee la bandeja y prioriza", en: "Read the inbox and prioritize" }, kind: 'doc', ref: 'bandeja' },
      { title: { es: "Cinco preguntas para calificar sin interrogar", en: "Five questions to qualify without interrogating" }, kind: 'post', ref: 'questions-to-qualify-a-prospect' },
      { title: { es: "Mide si tu agente de ventas funciona", en: "Measure whether your sales agent works" }, kind: 'post', ref: 'how-to-measure-whether-your-sales-agent-works' },
    ],
  },
  {
    id: 'citas',
    slug: { es: "agenda-y-atencion", en: "booking-and-support" },
    title: { es: "Agenda y atención al cliente", en: "Booking and customer support" },
    for: { es: "Para clínicas, servicios y equipos de soporte.", en: "For clinics, services and support teams." },
    goal: { es: "Al terminar tienes un flujo de citas con reglas claras y un traspaso que no obliga al cliente a repetir todo.", en: "By the end you have a booking flow with clear rules and a handoff that does not make the customer repeat everything." },
    type: 'curso',
    level: 'intermedio',
    products: ['agenda', 'agentes'],
    audience: ['servicios', 'soporte'],
    lessons: [
      { title: { es: "Agenda de citas", en: "Appointment booking" }, kind: 'doc', ref: 'agenda' },
      { title: { es: "Diseña el flujo de citas", en: "Design the booking flow" }, kind: 'post', ref: 'booking-appointments-on-whatsapp-with-an-ai-agent' },
      { title: { es: "Traspaso a una persona", en: "Handoff to a person" }, kind: 'doc', ref: 'traspaso' },
      { title: { es: "Escribe una base de conocimiento que responda", en: "Write a knowledge base that answers" }, kind: 'doc', ref: 'base-de-conocimiento' },
    ],
  },
  {
    id: 'tienda',
    slug: { es: "conectar-tu-tienda", en: "connect-your-store" },
    title: { es: "Conectar tu tienda con tu agente", en: "Connect your store to your agent" },
    for: { es: "Para tiendas Tiendanube y WooCommerce.", en: "For Tiendanube and WooCommerce stores." },
    goal: { es: "Al terminar tu agente busca productos, consulta envíos y crea pedidos con link de pago de tu tienda.", en: "By the end your agent searches products, checks shipping and creates orders with your store's payment link." },
    type: 'curso',
    level: 'intermedio',
    products: ['integraciones', 'agentes'],
    audience: ['tiendas'],
    lessons: [
      { title: { es: "Conecta Tiendanube o WooCommerce", en: "Connect Tiendanube or WooCommerce" }, kind: 'doc', ref: 'conectar-tienda' },
      { title: { es: "Otras integraciones y herramientas", en: "Other integrations and tools" }, kind: 'doc', ref: 'integraciones' },
      { title: { es: "Cárgale lo que sabe tu negocio", en: "Load what your business knows" }, kind: 'doc', ref: 'base-de-conocimiento' },
      { title: { es: "Pruébalo antes de salir al aire", en: "Test it before going live" }, kind: 'doc', ref: 'probar-antes' },
    ],
  },
  {
    id: 'agencias',
    slug: { es: "para-agencias", en: "for-agencies" },
    title: { es: "Para agencias que implementan", en: "For agencies that implement" },
    for: { es: "Para quien monta agentes para sus clientes.", en: "For anyone building agents for their customers." },
    goal: { es: "Al terminar tienes un proceso repetible de implementación y sabes cómo funciona el programa de socios.", en: "By the end you have a repeatable implementation process and know how the partner program works." },
    type: 'curso',
    level: 'avanzado',
    products: ['integraciones', 'socios'],
    audience: ['agencias'],
    lessons: [
      { title: { es: "Implementa con una lista de control", en: "Implement with a checklist" }, kind: 'doc', ref: 'probar-antes' },
      { title: { es: "Integraciones y herramientas externas", en: "Integrations and external tools" }, kind: 'doc', ref: 'integraciones' },
      { title: { es: "El programa de socios", en: "The partner program" }, kind: 'page', ref: 'partners' },
      { title: { es: "Directorio de socios", en: "Partner directory" }, kind: 'page', ref: 'partnersDirectory' },
    ],
  },
];

/** Artículos del blog que son lecciones (design/web: `POSTS`, buscados por `slug[1]`). */
export const ACADEMY_POSTS: readonly AcademyPostData[] = [
  {
    ref: 'how-to-measure-whether-your-sales-agent-works',
    slug: { es: "como-medir-si-tu-agente-de-ventas-funciona", en: "how-to-measure-whether-your-sales-agent-works" },
    title: { es: "Cómo medir si tu agente de ventas funciona (sin perderte en métricas)", en: "How to measure whether your sales agent works (without drowning in metrics)" },
    excerpt: { es: "Cuatro preguntas que puedes responder cada semana con lo que ya tienes en tu bandeja y tu CRM.", en: "Four questions you can answer every week with what you already have in your inbox and your CRM." },
    minutes: 6,
  },
  {
    ref: 'questions-to-qualify-a-prospect',
    slug: { es: "preguntas-para-calificar-a-un-prospecto", en: "questions-to-qualify-a-prospect" },
    title: { es: "Cinco preguntas para calificar a un prospecto en la conversación sin parecer un interrogatorio", en: "Five questions to qualify a prospect in chat without sounding like an interrogation" },
    excerpt: { es: "Calificar no es filtrar a la gente, es saber a quién atender primero. Qué preguntar, en qué orden y cómo guardarlo en el CRM.", en: "Qualifying is not screening people out, it is knowing who to serve first. What to ask, in what order and how to save it in the CRM." },
    minutes: 6,
  },
  {
    ref: 'booking-appointments-on-whatsapp-with-an-ai-agent',
    slug: { es: "agendar-citas-por-whatsapp-con-un-agente-de-ia", en: "booking-appointments-on-whatsapp-with-an-ai-agent" },
    title: { es: "Agendar citas por WhatsApp con un agente de IA: cómo diseñarlo para clínicas y servicios", en: "Booking appointments on WhatsApp with an AI agent: how to design it for clinics and services" },
    excerpt: { es: "Una cita bien agendada es una conversación corta con reglas claras. Así se arma el flujo, qué datos pedir y cuándo pasar a una persona.", en: "A well-booked appointment is a short conversation with clear rules. How to build the flow, which data to ask for and when to hand over to a person." },
    minutes: 6,
  },
];
