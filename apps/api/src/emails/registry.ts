/**
 * Todos los correos de la plataforma con datos de ejemplo: para la vista previa
 * (`npm run emails:preview`), el envío de prueba (`emails:send-test`) y los tests.
 */
import {
  accountLinkedEmail,
  agentNotificationEmail,
  agentNotificationTestEmail,
  appointmentConfirmedEmail,
  appointmentNewEmail,
  highScoreLeadEmail,
  inboxWaitAlertEmail,
  invitationEmail,
  orgAccessEmail,
  orgSuspendedEmail,
  passwordResetEmail,
  planLimitEmail,
  verifyEmail,
  welcomeEmail,
} from './index';
import { wrapInternalHtml, htmlToText } from './layout';
import { webUrl, APP_PATHS } from './links';
import { buildContactEmail, contactSalesSchema } from '../services/contact-sales.service';
import { buildDocsFeedbackEmail, docsFeedbackSchema } from '../services/docs-feedback.service';
import type { EmailLang, RenderedEmail } from './types';
import { DOC_FEEDBACK_REASONS } from '@gensmart/shared';

export interface RegistryEntry {
  id: string;
  /** Qué correo es, para la lista de la vista previa. */
  label: string;
  recipient: string;
  /** Los internos solo salen en inglés. */
  languages: readonly EmailLang[];
  build: (lang: EmailLang) => RenderedEmail;
}

const BOTH = ['es', 'en'] as const;
const sample = (lang: EmailLang) =>
  lang === 'es'
    ? { name: 'Ana', org: 'Floristería Ana', contact: 'María Gómez', service: 'arreglos para eventos', agent: 'Asistente de ventas', channel: 'WhatsApp', calendar: 'Asesorías', summary: 'Arreglos florales para una boda de 120 invitados: estilo, colores y presupuesto.' }
    : { name: 'Ana', org: 'Ana Florist', contact: 'María Gómez', service: 'event arrangements', agent: 'Sales assistant', channel: 'WhatsApp', calendar: 'Consultations', summary: 'Flower arrangements for a 120-guest wedding: style, colors and budget.' };

function internal(subject: string, contentHtml: string): RenderedEmail {
  const html = wrapInternalHtml(contentHtml);
  return { subject, html, text: htmlToText(html) };
}

export const EMAIL_REGISTRY: readonly RegistryEntry[] = [
  { id: 'welcome', label: 'Bienvenida', recipient: 'el usuario', languages: BOTH, build: (l) => welcomeEmail({ name: sample(l).name, organizationName: sample(l).org }, l) },
  { id: 'verify-email', label: 'Verificar el correo', recipient: 'el usuario', languages: BOTH, build: (l) => verifyEmail({ name: sample(l).name, token: 'token-de-ejemplo' }, l) },
  { id: 'password-reset', label: 'Recuperar la contraseña', recipient: 'el usuario', languages: BOTH, build: (l) => passwordResetEmail({ name: sample(l).name, token: 'token-de-ejemplo' }, l) },
  { id: 'account-linked', label: 'Vinculamos tu cuenta de Google', recipient: 'el usuario', languages: BOTH, build: (l) => accountLinkedEmail({ name: sample(l).name, provider: 'Google' }, l) },
  { id: 'invitation', label: 'Invitación al equipo', recipient: 'el invitado', languages: BOTH, build: (l) => invitationEmail({ inviterName: 'Carlos', organizationName: sample(l).org, token: 'token-de-ejemplo' }, l) },
  { id: 'org-access', label: 'Acceso de tienda (Tiendanube)', recipient: 'el dueño de la tienda', languages: BOTH, build: (l) => orgAccessEmail({ storeName: sample(l).org, token: 'token-de-ejemplo' }, l) },
  {
    id: 'high-score-lead', label: 'Lead con puntaje alto', recipient: 'los usuarios de la organización', languages: BOTH,
    build: (l) => highScoreLeadEmail({ name: sample(l).name, score: 9, contactName: sample(l).contact, service: sample(l).service, agentName: sample(l).agent, channelLabel: sample(l).channel, conversationId: '00000000-0000-0000-0000-000000000000' }, l),
  },
  {
    id: 'inbox-wait-alert', label: 'Bandeja: conversación esperando (meta de respuesta)', recipient: 'quien la tiene, o owner y admin', languages: BOTH,
    build: (l) => inboxWaitAlertEmail({ name: sample(l).name, waitingMinutes: 34, alertMinutes: 30, contactName: sample(l).contact, agentName: sample(l).agent, channelLabel: sample(l).channel, conversationId: '00000000-0000-0000-0000-000000000000' }, l),
  },
  { id: 'plan-limit', label: 'Límite de mensajes (100 %)', recipient: 'los usuarios de la organización', languages: BOTH, build: (l) => planLimitEmail({ name: sample(l).name, organizationName: sample(l).org, used: 1000, limit: 1000 }, l) },
  { id: 'trial-ended', label: 'Prueba terminada', recipient: 'los usuarios de la organización', languages: BOTH, build: (l) => orgSuspendedEmail({ name: sample(l).name, organizationName: sample(l).org, reason: 'trial_expired' }, l) },
  { id: 'subscription-paused', label: 'Suscripción en pausa', recipient: 'los usuarios de la organización', languages: BOTH, build: (l) => orgSuspendedEmail({ name: sample(l).name, organizationName: sample(l).org, reason: 'subscription_cancelled' }, l) },
  {
    id: 'appointment-new', label: 'Cita nueva', recipient: 'calendars.notification_email', languages: BOTH,
    build: (l) => appointmentNewEmail({ personName: sample(l).contact, date: '2026-12-03', time: '15:00', calendarName: sample(l).calendar, phone: '+57 300 123 4567', summary: sample(l).summary }, l),
  },
  {
    id: 'appointment-confirmed', label: 'Cita confirmada', recipient: 'el cliente final', languages: BOTH,
    build: (l) => appointmentConfirmedEmail({ contactName: 'María', businessName: sample(l).org, calendarName: sample(l).calendar, date: '2026-12-03', time: '15:00', startTime: '2026-12-03T20:00:00.000Z', endTime: '2026-12-03T20:30:00.000Z', summary: sample(l).summary }, l),
  },
  {
    id: 'agent-notification', label: 'Contenedor del correo del agente', recipient: 'lo que configura la organización', languages: BOTH,
    build: (l) => agentNotificationEmail({
      subject: l === 'es' ? 'Nuevo pedido de cotización: María Gómez' : 'New quote request: María Gómez',
      bodyHtml: l === 'es'
        ? '<p>María Gómez pidió una cotización para <b>arreglos de boda</b>.</p><p>Teléfono: +57 300 123 4567</p>'
        : '<p>María Gómez asked for a quote for <b>wedding arrangements</b>.</p><p>Phone: +57 300 123 4567</p>',
      agentName: sample(l).agent,
      conversationUrl: webUrl(APP_PATHS.conversation('00000000-0000-0000-0000-000000000000')),
    }, l),
  },
  {
    id: 'agent-notification-test', label: 'Prueba de la herramienta de correo', recipient: 'lo que configura la organización', languages: BOTH,
    build: (l) => agentNotificationTestEmail({ subject: l === 'es' ? 'Nuevo pedido de cotización' : 'New quote request', toolName: 'notify_sales', recipient: 'ventas@example.com', sampleParams: { name: '[Test value for name]' } }, l),
  },
  {
    id: 'contact-sales', label: 'Contacto con ventas (interno)', recipient: 'el equipo', languages: ['en'],
    build: () => {
      const { subject, content } = buildContactEmail(contactSalesSchema.parse({
        name: 'María Gómez', email: 'maria@example.com', company: 'Floristería Ana', message: 'Queremos ver el plan para varias sucursales.', type: 'demo', language: 'es',
      }));
      return internal(subject, content);
    },
  },
  {
    id: 'docs-feedback', label: 'Comentarios de docs (interno)', recipient: 'el equipo', languages: ['en'],
    build: () => {
      const { subject, content } = buildDocsFeedbackEmail(docsFeedbackSchema.parse({ page: 'primer-agente', language: 'es', helpful: false, reason: DOC_FEEDBACK_REASONS[0], comment: 'Faltan capturas del paso 3.' }));
      return internal(subject, content);
    },
  },
];
