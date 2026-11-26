import { renderEmail } from '../layout';
import { APP_PATHS, siteUrl, webUrl } from '../links';
import { getStrings } from '../strings';
import type { EmailLang, RenderedEmail } from '../types';

export interface AccountLinkedEmailData {
  name: string;
  /** Nombre del proveedor ("Google"). */
  provider: string;
}

export function accountLinkedEmail(data: AccountLinkedEmailData, lang: EmailLang): RenderedEmail {
  const s = getStrings(lang).accountLinked;
  const l = getStrings(lang).layout;
  return renderEmail({
    lang,
    subject: s.subject(data.provider),
    preheader: s.preheader(data.provider),
    footerReason: l.footerAccount,
    blocks: [
      { type: 'heading', text: s.heading(data.provider) },
      { type: 'paragraph', parts: [s.greeting(data.name)] },
      { type: 'paragraph', parts: [s.body(data.provider)] },
      {
        type: 'paragraph',
        small: true,
        parts: [
          s.notYouBefore,
          { link: s.notYouReset, href: webUrl(APP_PATHS.forgotPassword) },
          s.notYouMiddle,
          { link: l.contactLink, href: siteUrl('contact', lang) },
          s.notYouEnd,
        ],
      },
    ],
  });
}
