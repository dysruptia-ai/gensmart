import { renderEmail } from '../layout';
import { APP_PATHS, webUrl } from '../links';
import { getStrings } from '../strings';
import type { EmailLang, RenderedEmail } from '../types';

export interface HighScoreLeadEmailData {
  /** Quien recibe el aviso. */
  name: string;
  score: number | null;
  contactName?: string | null;
  service?: string | null;
  agentName?: string | null;
  /** Canal ya legible ("WhatsApp", "Sitio web"). */
  channelLabel?: string | null;
  conversationId?: string | null;
}

export function highScoreLeadEmail(data: HighScoreLeadEmailData, lang: EmailLang): RenderedEmail {
  const s = getStrings(lang).highScoreLead;
  const contact = data.contactName?.trim() || s.unnamedContact;
  const score = data.score === null || Number.isNaN(data.score) ? '?' : String(data.score);
  const lines: string[] = [];
  if (data.service?.trim()) lines.push(s.service(data.service.trim()));
  if (data.agentName?.trim()) {
    lines.push(s.agent(data.channelLabel ? `${data.agentName.trim()} · ${data.channelLabel}` : data.agentName.trim()));
  }
  const href = webUrl(data.conversationId ? APP_PATHS.conversation(data.conversationId) : APP_PATHS.contacts);
  return renderEmail({
    lang,
    subject: s.subject(score, contact),
    preheader: s.preheader,
    footerReason: getStrings(lang).layout.footerAccount,
    blocks: [
      { type: 'heading', text: s.heading },
      { type: 'paragraph', parts: [s.body(data.name)] },
      { type: 'score', score, outOf: s.outOf, title: contact, lines },
      { type: 'button', label: s.cta, href },
      { type: 'paragraph', parts: [s.note], small: true },
    ],
  });
}
