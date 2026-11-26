import { renderEmail } from '../layout';
import { APP_PATHS, webUrl } from '../links';
import { contactParagraph } from '../parts';
import { getStrings } from '../strings';
import type { EmailLang, RenderedEmail } from '../types';

export type SuspensionReason = 'trial_expired' | 'subscription_cancelled';

export interface OrgSuspendedEmailData {
  name: string;
  organizationName: string;
  reason: SuspensionReason;
}

/** Cuenta en pausa: con `trial_expired`, la prueba gratis terminó; si no, la suscripción se canceló. */
export function orgSuspendedEmail(data: OrgSuspendedEmailData, lang: EmailLang): RenderedEmail {
  const all = getStrings(lang);
  const s = data.reason === 'trial_expired' ? all.trialEnded : all.subscriptionPaused;
  const help = data.reason === 'trial_expired' ? all.trialEnded.helpIntro : undefined;
  return renderEmail({
    lang,
    subject: s.subject,
    preheader: s.preheader,
    footerReason: all.layout.footerAccount,
    blocks: [
      { type: 'heading', text: s.heading },
      { type: 'paragraph', parts: [s.bodyBefore(data.name), { bold: data.organizationName }, s.bodyAfter] },
      { type: 'notice', tone: 'warn', parts: [s.notice] },
      { type: 'paragraph', parts: [s.next] },
      { type: 'button', label: s.cta, href: webUrl(APP_PATHS.billing) },
      contactParagraph(lang, help),
    ],
  });
}
