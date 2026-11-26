import { sanitizeDisplayName } from '../utils/html';

/**
 * Saca la dirección de `SMTP_FROM`, que puede venir sola (`noreply@x.co`) o con nombre
 * (`GenSmart <noreply@x.co>`, `"Gen \"Smart\"" <noreply@x.co>`).
 */
export function parseFromAddress(smtpFrom: string): string {
  const raw = smtpFrom.trim();
  const angled = /<\s*([^<>\s]+@[^<>\s]+)\s*>\s*$/.exec(raw);
  if (angled?.[1]) return angled[1];
  const bare = /([^\s<>"']+@[^\s<>"']+)/.exec(raw);
  return bare?.[1] ?? raw;
}

/**
 * Remitente con otro nombre visible y la dirección de `SMTP_FROM`. El nombre se limpia (sin comillas,
 * corchetes ni saltos de línea) y va entre comillas; si queda vacío, se usa `SMTP_FROM` tal cual.
 */
export function buildFromAddress(displayName: string | null | undefined, smtpFrom: string): string {
  const name = displayName ? sanitizeDisplayName(displayName) : '';
  if (!name) return smtpFrom;
  return `"${name}" <${parseFromAddress(smtpFrom)}>`;
}
