/**
 * Input checks for the public widget endpoints. Pure functions, no imports from the app.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): boolean {
  return typeof value === 'string' && UUID_RE.test(value);
}

/** Strings are cut to `max` characters; anything that is not a string gives null. */
export function clampString(value: unknown, max: number): string | null {
  return typeof value === 'string' ? value.slice(0, max) : null;
}

/** Standard base64 alphabet (padding optional), ignoring whitespace and line breaks. Empty is not valid. */
export function isBase64(value: string): boolean {
  const clean = value.replace(/\s+/g, '');
  if (clean.length === 0 || clean.length % 4 === 1) return false;
  return /^[A-Za-z0-9+/]+={0,2}$/.test(clean);
}

/** First `bytes` bytes of a base64 payload, decoding only the prefix that is needed. */
export function decodedHead(base64: string, bytes: number): Buffer {
  const clean = base64.replace(/\s+/g, '');
  const chars = Math.ceil(bytes / 3) * 4;
  return Buffer.from(clean.slice(0, chars), 'base64').subarray(0, bytes);
}
