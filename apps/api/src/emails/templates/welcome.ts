import { renderEmail } from '../layout';
import { APP_PATHS, siteUrl, webUrl, WELCOME_VIDEO, type SitePathId } from '../links';
import { contactParagraph } from '../parts';
import { getStrings } from '../strings';
import type { EmailLang, RenderedEmail } from '../types';

export interface WelcomeEmailData {
  name: string;
  organizationName?: string | null;
}

const CAMPAIGN = 'welcome';

/** `utm_content` de cada enlace al sitio (iguales en ES y EN). */
export const WELCOME_UTM_CONTENT = {
  blogStartPyme: 'guia-pymes',
  docFirstAgent: 'primer-agente',
  blogKnowledgeBase: 'base-conocimiento',
  blogConnectWhatsApp: 'conectar-whatsapp',
  blogChecklist: 'checklist',
  docs: 'todas-las-guias',
  contact: 'contacto',
} as const satisfies Partial<Record<SitePathId, string>>;

const link = (id: keyof typeof WELCOME_UTM_CONTENT, lang: EmailLang): string =>
  siteUrl(id, lang, { campaign: CAMPAIGN, content: WELCOME_UTM_CONTENT[id] });

export function welcomeEmail(data: WelcomeEmailData, lang: EmailLang): RenderedEmail {
  const s = getStrings(lang).welcome;
  const org = data.organizationName?.trim();
  return renderEmail({
    lang,
    subject: s.subject(data.name),
    preheader: s.preheader,
    footerReason: s.footer,
    blocks: [
      { type: 'heading', text: s.heading(data.name) },
      { type: 'paragraph', parts: org ? [s.introBefore, { bold: org }, s.introAfter] : [s.introNoOrg] },
      { type: 'button', label: s.cta, href: webUrl(APP_PATHS.newAgent) },
      {
        type: 'video',
        href: WELCOME_VIDEO.url,
        ariaLabel: s.videoAria,
        title: s.videoTitle,
        meta: s.videoMeta(WELCOME_VIDEO.duration),
        source: s.videoSource,
        note: s.videoNote,
      },
      {
        type: 'guides',
        title: s.guidesTitle,
        items: [
          { href: link('blogStartPyme', lang), title: s.guide1Title, description: s.guide1Desc },
          { href: link('docFirstAgent', lang), title: s.guide2Title, description: s.guide2Desc },
          { href: link('blogKnowledgeBase', lang), title: s.guide3Title, description: s.guide3Desc },
          { href: link('blogConnectWhatsApp', lang), title: s.guide4Title, description: s.guide4Desc },
          { href: link('blogChecklist', lang), title: s.guide5Title, description: s.guide5Desc },
        ],
        allLabel: s.guidesAll,
        allHref: link('docs', lang),
      },
      contactParagraph(lang, undefined, link('contact', lang)),
    ],
  });
}
