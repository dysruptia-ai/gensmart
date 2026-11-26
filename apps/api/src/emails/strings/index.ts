import { es } from './es';
import { en } from './en';
import type { EmailLang } from '../types';

export type EmailStrings = typeof es;

const STRINGS: Record<EmailLang, EmailStrings> = { es, en };

export function getStrings(lang: EmailLang): EmailStrings {
  return STRINGS[lang];
}
