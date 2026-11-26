import { env } from '../config/env';
import type { EmailLang } from './types';

/**
 * URL de la web (la única para todos los correos). En local `http://localhost:3000` y en
 * producción `https://www.gensmart.co`, las dos desde `FRONTEND_URL`. Nunca la de la API.
 */
export function getWebUrl(): string {
  return env.FRONTEND_URL.replace(/\/+$/, '');
}

/**
 * Origen de las imágenes de los correos (`EMAIL_ASSETS_URL`, por defecto `https://www.gensmart.co`,
 * no `FRONTEND_URL`): así los correos de prueba mandados desde local también muestran el logo.
 */
export const EMAIL_ASSETS_URL = env.EMAIL_ASSETS_URL.replace(/\/+$/, '');

/** Los dos logos (en `apps/web/public/email/`, a 3x). */
export const EMAIL_LOGO = {
  light: `${EMAIL_ASSETS_URL}/email/gensmart-logo.png`,
  dark: `${EMAIL_ASSETS_URL}/email/gensmart-logo-dark.png`,
} as const;

/** Ruta de la web a URL absoluta. */
export function webUrl(path: string): string {
  return `${getWebUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Rutas del sitio público que usan los correos, por idioma. Salen del registro de la web
 * (`apps/web/lib/site-routes.ts`, `docs-routes.ts`, `legal-routes.ts` y `blog-index.generated.json`);
 * la API no puede importar ese código, así que `emails.test.ts` comprueba que coincidan.
 */
export const SITE_PATHS = {
  home: { es: '/', en: '/en' },
  contact: { es: '/contacto', en: '/en/contact' },
  privacy: { es: '/legal/politica-de-privacidad', en: '/en/legal/privacy-policy' },
  docs: { es: '/docs', en: '/en/docs' },
  docFirstAgent: { es: '/docs/crear-tu-primer-agente', en: '/en/docs/create-your-first-agent' },
  blogStartPyme: {
    es: '/blog/guia-para-empezar-con-ia-conversacional-en-una-pyme',
    en: '/en/blog/getting-started-with-conversational-ai-in-a-small-business',
  },
  blogKnowledgeBase: {
    es: '/blog/como-escribir-la-base-de-conocimiento-de-tu-agente',
    en: '/en/blog/how-to-write-your-agents-knowledge-base',
  },
  blogConnectWhatsApp: { es: '/blog/conectar-whatsapp-en-dos-clics', en: '/en/blog/connect-whatsapp-one-click' },
  blogChecklist: {
    es: '/blog/checklist-antes-de-poner-tu-agente-en-vivo',
    en: '/en/blog/checklist-before-putting-your-agent-live',
  },
} as const satisfies Record<string, Record<EmailLang, string>>;

export type SitePathId = keyof typeof SITE_PATHS;

export function siteUrl(id: SitePathId, lang: EmailLang, utm?: UtmParams): string {
  const url = webUrl(SITE_PATHS[id][lang]);
  return utm ? withUtm(url, utm) : url;
}

export interface UtmParams {
  campaign: string;
  /** Qué enlace del correo tocó la persona. */
  content?: string;
}

/** Valores de UTM permitidos: minúsculas, números y guiones. */
export const UTM_VALUE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Agrega los UTM de los correos (`source` y `medium` fijos) a una URL del sitio. */
export function withUtm(url: string, { campaign, content }: UtmParams): string {
  const params = new URLSearchParams({ utm_source: 'gensmart', utm_medium: 'email', utm_campaign: campaign });
  if (content) params.set('utm_content', content);
  return `${url}${url.includes('?') ? '&' : '?'}${params.toString()}`;
}

/** Rutas de la plataforma (dashboard y acceso). */
export const APP_PATHS = {
  newAgent: '/dashboard/agents/new',
  billing: '/dashboard/billing',
  calendar: '/dashboard/calendar',
  contacts: '/dashboard/contacts',
  conversation: (id: string) => `/dashboard/conversations/${encodeURIComponent(id)}`,
  verifyEmail: (token: string) => `/verify-email?token=${encodeURIComponent(token)}`,
  resetPassword: (token: string) => `/reset-password/${encodeURIComponent(token)}`,
  orgAccess: (token: string) => `/org-access/${encodeURIComponent(token)}`,
  forgotPassword: '/forgot-password',
} as const;

/** El video de presentación del correo de bienvenida. */
export const WELCOME_VIDEO = {
  url: 'https://www.youtube.com/watch?v=hgc0L3aEJT0',
  duration: '2:10',
} as const;
