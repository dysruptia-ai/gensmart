import { renderEmail } from '../layout';
import { APP_PATHS, webUrl } from '../links';
import { contactParagraph } from '../parts';
import { getStrings } from '../strings';
import type { EmailLang, RenderedEmail } from '../types';

export interface OrgAccessEmailData {
  storeName: string;
  token: string;
}

/** Acceso a la organización creada desde una tienda (Tiendanube): enlace de un solo uso. */
export function orgAccessEmail(data: OrgAccessEmailData, lang: EmailLang): RenderedEmail {
  const s = getStrings(lang).orgAccess;
  const url = webUrl(APP_PATHS.orgAccess(data.token));
  return renderEmail({
    lang,
    subject: s.subject(data.storeName),
    preheader: s.preheader,
    footerReason: s.footer(data.storeName),
    blocks: [
      { type: 'heading', text: s.heading(data.storeName) },
      { type: 'paragraph', parts: [s.readyBefore, { bold: data.storeName }, s.readyAfter] },
      { type: 'paragraph', parts: [s.body] },
      { type: 'paragraph', parts: [s.lead] },
      { type: 'button', label: s.cta, href: url },
      { type: 'linkFallback', intro: getStrings(lang).layout.buttonFallback, href: url },
      { type: 'paragraph', parts: [s.expiry], small: true },
      contactParagraph(lang),
    ],
  });
}
