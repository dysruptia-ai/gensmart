import { renderEmail } from '../layout';
import { APP_PATHS, webUrl } from '../links';
import { getStrings } from '../strings';
import type { EmailLang, RenderedEmail } from '../types';

export interface InvitationEmailData {
  /** Quien invita; vacío usa "Alguien de tu equipo". */
  inviterName?: string | null;
  organizationName: string;
  token: string;
}

/** Invitación al equipo: lleva a crear la contraseña (`/reset-password/<token>`). */
export function invitationEmail(data: InvitationEmailData, lang: EmailLang): RenderedEmail {
  const s = getStrings(lang).invitation;
  const inviter = data.inviterName?.trim() || s.inviterFallback;
  const url = webUrl(APP_PATHS.resetPassword(data.token));
  return renderEmail({
    lang,
    subject: s.subject(inviter, data.organizationName),
    preheader: s.preheader,
    footerReason: s.footer(data.organizationName),
    blocks: [
      { type: 'heading', text: s.heading(inviter) },
      { type: 'paragraph', parts: [inviter, s.bodyMiddle, { bold: data.organizationName }, s.bodyAfter] },
      { type: 'paragraph', parts: [s.lead] },
      { type: 'button', label: s.cta, href: url },
      { type: 'linkFallback', intro: getStrings(lang).layout.buttonFallback, href: url },
      { type: 'paragraph', parts: [s.expiry], small: true },
    ],
  });
}
