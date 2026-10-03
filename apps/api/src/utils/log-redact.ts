/**
 * Redaction of request URLs before they reach the access log. No imports on purpose.
 * The query string is dropped entirely (it can carry verify tokens or session ids) and the path
 * segments that act as credentials are replaced.
 */
export function redactUrlForLog(url: string): string {
  const path = String(url).split(/[?#]/)[0] ?? '';
  return path
    .replace(/^(\/api\/auth\/org-access\/)[^/]+(\/resend\/?)$/, '$1[redacted]$2')
    .replace(/^(\/api\/widget\/[^/]+\/session\/)[^/]+/, '$1[redacted]');
}
