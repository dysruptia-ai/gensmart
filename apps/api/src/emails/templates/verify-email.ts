import { renderEmail } from '../layout';
import { APP_PATHS, webUrl } from '../links';
import { getStrings } from '../strings';
import type { EmailLang, RenderedEmail } from '../types';

export interface VerifyEmailData {
  name: string;
  token: string;
}

/** Mismo diseño que el de recuperar la contraseña (design/05-acceso). */
export function verifyEmail(data: VerifyEmailData, lang: EmailLang): RenderedEmail {
  const s = getStrings(lang).verify;
  const url = webUrl(APP_PATHS.verifyEmail(data.token));
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
