import { renderEmail } from '../layout';
import { APP_PATHS, webUrl } from '../links';
import type { Block } from '../layout';
import { contactParagraph, emailLocale } from '../parts';
import { getStrings } from '../strings';
import type { EmailLang, RenderedEmail } from '../types';

export interface PlanLimitEmailData {
  name: string;
  organizationName: string;
  /** Mensajes usados y límite del período, tal como los calcula `usage.service`. Sin ellos no va la línea de cifras. */
  used?: number | null;
  limit?: number | null;
}

/** Límite de mensajes al 100 %: el mismo recuadro de aviso que la prueba terminada. Las cifras, solo si llegan. */
export function planLimitEmail(data: PlanLimitEmailData, lang: EmailLang): RenderedEmail {
  const s = getStrings(lang).planLimit;
  const fmt = new Intl.NumberFormat(emailLocale(lang));
  const { used, limit } = data;
  const usage: Block[] =
    typeof used === 'number' && typeof limit === 'number'
      ? [{ type: 'paragraph', parts: [s.usage(fmt.format(used), fmt.format(limit))] }]
      : [];
  return renderEmail({
    lang,
    subject: s.subject,
    preheader: s.preheader,
    footerReason: getStrings(lang).layout.footerAccount,
    blocks: [
      { type: 'heading', text: s.heading },
      { type: 'paragraph', parts: [s.bodyBefore(data.name), { bold: data.organizationName }, s.bodyAfter] },
      ...usage,
      { type: 'notice', tone: 'warn', parts: [s.notice] },
      { type: 'paragraph', parts: [s.next] },
      { type: 'button', label: s.cta, href: webUrl(APP_PATHS.billing) },
      contactParagraph(lang),
    ],
  });
}
