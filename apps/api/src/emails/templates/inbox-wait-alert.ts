import { renderEmail } from '../layout';
import { APP_PATHS, webUrl } from '../links';
import { getStrings } from '../strings';
import type { EmailLang, RenderedEmail } from '../types';

export interface InboxWaitAlertEmailData {
  /** Quien recibe el aviso. */
  name: string;
  /** Minutos de atención que lleva esperando. */
  waitingMinutes: number;
  /** El umbral de la alerta (Ajustes de la Bandeja). */
  alertMinutes: number;
  contactName?: string | null;
  agentName?: string | null;
  /** Canal ya legible ("WhatsApp", "Sitio web"). */
  channelLabel: string;
  conversationId: string;
}

/** "1 h 5 min", "45 min". */
export function formatWait(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

/** Correo de la meta de respuesta (web-45): una conversación pasó el tiempo de alerta. */
export function inboxWaitAlertEmail(data: InboxWaitAlertEmailData, lang: EmailLang): RenderedEmail {
  const s = getStrings(lang).inboxWaitAlert;
  const contact = data.contactName?.trim() || s.unnamedContact;
  const wait = formatWait(data.waitingMinutes);
  const rows = [
    { label: s.waiting, value: wait },
    { label: s.contact, value: contact },
    { label: s.channel, value: data.channelLabel },
    ...(data.agentName?.trim() ? [{ label: s.agent, value: data.agentName.trim() }] : []),
  ];
  return renderEmail({
    lang,
    subject: s.subject(wait, contact),
    preheader: s.preheader,
    footerReason: getStrings(lang).layout.footerAccount,
    blocks: [
      { type: 'heading', text: s.heading },
      { type: 'paragraph', parts: [s.body(data.name)] },
      { type: 'details', rows },
      { type: 'button', label: s.cta, href: webUrl(APP_PATHS.conversation(data.conversationId)) },
      { type: 'paragraph', parts: [s.note(String(data.alertMinutes))], small: true },
    ],
  });
}
