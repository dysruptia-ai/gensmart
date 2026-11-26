import { renderEmail } from '../layout';
import { APP_PATHS, webUrl } from '../links';
import { getStrings } from '../strings';
import type { EmailLang, RenderedEmail } from '../types';

export interface PasswordResetEmailData {
  name: string;
  token: string;
}

/** Mismo diseño que el de verificar el correo (design/05-acceso). */
export function passwordResetEmail(data: PasswordResetEmailData, lang: EmailLang): RenderedEmail {
  const s = getStrings(lang).reset;
  const url = webUrl(APP_PATHS.resetPassword(data.token));
  return renderEmail({
    lang,
    subject: s.subject,
    preheader: s.preheader,
    footerReason: s.footer,
    blocks: [
      { type: 'heading', text: s.heading },
      { type: 'paragraph', parts: [s.greeting(data.name)] },
      { type: 'paragraph', parts: [s.body] },
      { type: 'button', label: s.cta, href: url },
      { type: 'linkFallback', intro: getStrings(lang).layout.buttonFallback, href: url },
      { type: 'paragraph', parts: [s.expiry], small: true },
    ],
  });
}
