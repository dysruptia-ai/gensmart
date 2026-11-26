/** Piezas que repiten varios correos. */
import type { Block, Inline } from './layout';
import { siteUrl } from './links';
import { getStrings } from './strings';
import type { EmailLang } from './types';

/** "¿Tienes dudas? Escríbenos desde la página de contacto." (o con otra introducción). */
export function contactParagraph(lang: EmailLang, intro?: string, href = siteUrl('contact', lang)): Block {
  const s = getStrings(lang).layout;
  const parts: Inline[] = [intro ?? s.contactIntro, { link: s.contactLink, href }, s.contactEnd];
  return { type: 'paragraph', parts, small: true };
}

/** Nombre para el saludo: el que llegue, o el comienzo del correo si está vacío. */
export function displayName(name: string | null | undefined, email: string): string {
  const n = (name ?? '').trim();
  return n || email.split('@')[0] || email;
}

const LOCALES: Record<EmailLang, string> = { es: 'es-CO', en: 'en-US' };

export function emailLocale(lang: EmailLang): string {
  return LOCALES[lang];
}

/**
 * Fecha y hora de una cita tal como la escribe el calendario (`YYYY-MM-DD` y `HH:MM`, hora local del
 * calendario), en palabras del idioma: "jueves 4 de diciembre" y "3:00 p. m.". Si no se puede leer,
 * devuelve lo que llegó.
 */
export function formatAppointment(date: string, time: string, lang: EmailLang): { date: string; time: string } {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  const t = /^(\d{1,2}):(\d{2})/.exec(time.trim());
  if (!d || !t) return { date, time };
  const at = new Date(Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2])));
  if (Number.isNaN(at.getTime())) return { date, time };
  const locale = emailLocale(lang);
  return {
    // En español sin la coma después del día de la semana ("jueves 4 de diciembre")
    date: new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
      .format(at)
      .replace(lang === 'es' ? /^([^\s,]+),/ : /$^/, '$1'),
    time: new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }).format(at),
  };
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
