export type EmailLang = 'es' | 'en';

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/** Cualquier valor guardado (`users.language`, null, otro idioma) a un idioma de correo: `en` por defecto. */
export function toEmailLang(value: string | null | undefined): EmailLang {
  return value === 'es' ? 'es' : 'en';
}

/** Persona que recibe un correo de la plataforma. */
export interface EmailRecipient {
  name: string;
  email: string;
  language?: string | null;
}
