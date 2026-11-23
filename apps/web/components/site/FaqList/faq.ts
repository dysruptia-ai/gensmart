/** Preguntas frecuentes del sitio público. Sin `'use client'`: el JSON-LD se arma en el servidor. */
import type { SiteLanguage } from '@/lib/site-routes';

export interface FaqItem {
  question: string;
  answer: string;
}

/** JSON-LD `FAQPage` con el mismo texto que muestra `FaqList`. */
export function faqPageJsonLd(items: readonly FaqItem[], url: string, lang: SiteLanguage) {
  return {
    '@type': 'FAQPage',
    '@id': `${url}#faq`,
    url,
    inLanguage: lang,
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}
