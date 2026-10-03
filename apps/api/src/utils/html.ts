/**
 * HTML and header escaping for values that are not written by the server itself.
 * No imports on purpose: testable on its own.
 */

/** Escapes & < > " ' so the text can sit in element content or in a quoted attribute. */
export function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escapes the text and turns line breaks into <br/>. */
export function escapeHtmlWithBreaks(text: string): string {
  return escapeHtml(text).replace(/\r\n|\r|\n/g, '<br/>');
}

/** For header values (subject): removes carriage returns and line feeds so nothing can inject a header. */
export function stripLineBreaks(text: string): string {
  return String(text).replace(/[\r\n]+/g, ' ').trim();
}

/** Display name for a From header: no quotes, angle brackets or line breaks. Empty result means "no name". */
export function sanitizeDisplayName(name: string, maxLength = 60): string {
  return String(name).replace(/["<>\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}
