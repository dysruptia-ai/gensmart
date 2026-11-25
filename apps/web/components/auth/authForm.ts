import { ApiError } from '@/lib/api';

/** El mismo criterio que el prototipo: algo@algo.tld (la API valida con Zod). */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Límite de intentos: el de la cuenta (TOO_MANY_ATTEMPTS) o el del limitador por IP (429). */
export function isRateLimited(err: unknown): boolean {
  return (
    err instanceof ApiError &&
    (err.status === 429 || err.code === 'TOO_MANY_ATTEMPTS' || err.code === 'RATE_LIMIT_EXCEEDED')
  );
}

/** Falló la conexión (no hubo respuesta de la API). */
export function isNetworkError(err: unknown): boolean {
  return !(err instanceof ApiError);
}

/** `from` solo acepta rutas internas: nunca una URL absoluta, `//host` ni `/\host`. */
export function safeFrom(raw: string | null): string {
  return raw && /^\/(?!\/|\\)[^\s]*$/.test(raw) ? raw : '/dashboard';
}
