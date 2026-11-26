import type { Block } from '../layout';
import { htmlToText, renderEmail } from '../layout';
import { getStrings } from '../strings';
import type { EmailLang, RenderedEmail } from '../types';

export interface AgentNotificationEmailData {
  /** Asunto ya armado con la plantilla de la organización (sin saltos de línea). */
  subject: string;
  /** Cuerpo ya armado: HTML de la organización con los valores escapados. */
  bodyHtml: string;
  agentName: string;
  conversationUrl?: string | null;
}

/** Contenedor del correo que arma el agente (herramienta "notificación por correo"). */
export function agentNotificationEmail(data: AgentNotificationEmailData, lang: EmailLang): RenderedEmail {
  const s = getStrings(lang).agentNotification;
  const blocks: Block[] = [
    { type: 'heading', text: data.subject },
    { type: 'rawHtml', html: data.bodyHtml, text: htmlToText(data.bodyHtml) },
    { type: 'paragraph', parts: [s.sentBy(data.agentName)], small: true },
  ];
  if (data.conversationUrl) blocks.push({ type: 'button', label: s.cta, href: data.conversationUrl });
  return renderEmail({
    lang,
    subject: data.subject,
    preheader: s.preheader(data.agentName),
    footerReason: s.footer,
    blocks,
  });
}

export interface AgentNotificationTestEmailData {
  subject: string;
  toolName: string;
  recipient: string;
  sampleParams: Record<string, unknown>;
}

/** Correo de prueba de la herramienta, desde el editor del agente. */
export function agentNotificationTestEmail(data: AgentNotificationTestEmailData, lang: EmailLang): RenderedEmail {
  const s = getStrings(lang).agentNotification;
  const subject = `${s.testSubjectPrefix} ${data.subject}`;
  return renderEmail({
    lang,
    subject,
    preheader: s.testNotice,
    footerReason: s.footer,
    blocks: [
      { type: 'heading', text: subject },
      { type: 'notice', tone: 'warn', parts: [s.testNotice] },
      {
        type: 'details',
        rows: [
          { label: s.testTool, value: data.toolName },
          { label: s.testRecipient, value: data.recipient },
          { label: s.testParams, value: JSON.stringify(data.sampleParams) },
        ],
      },
    ],
  });
}
