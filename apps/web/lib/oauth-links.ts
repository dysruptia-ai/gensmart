import { API_BASE_URL } from '@/lib/api';

/** Proveedores de ingreso externo que la API sabe atender (`/api/auth/:provider/start`). */
export type OAuthProviderId = 'google';

export interface OAuthStartParams {
  intent: 'login' | 'register';
  lang: 'es' | 'en';
  /** Solo rutas internas: la API vuelve a validarlo. */
  from?: string;
  plan?: string;
  code?: string;
  ref?: string;
}

/**
 * Enlace al inicio del ingreso con un proveedor. Es una navegación normal a la API (no hay script
 * del proveedor en la página): la API guarda el estado y redirige a la pantalla del proveedor.
 */
export function oauthStartHref(provider: OAuthProviderId, params: OAuthStartParams): string {
  const qs = new URLSearchParams({ intent: params.intent, lang: params.lang });
  if (params.from && params.from !== '/dashboard') qs.set('from', params.from);
  if (params.plan) qs.set('plan', params.plan);
  if (params.code) qs.set('code', params.code);
  if (params.ref) qs.set('ref', params.ref);
  return `${API_BASE_URL}/api/auth/${provider}/start?${qs.toString()}`;
}

/** Avisos que la API deja en `?oauth_error=` al volver del proveedor. */
export const OAUTH_ERROR_CODES = ['cancelled', 'expired', 'unverified', 'conflict', 'unavailable', 'failed'] as const;
export type OAuthErrorCode = (typeof OAUTH_ERROR_CODES)[number];

export function parseOAuthError(raw: string | null): OAuthErrorCode | null {
  return OAUTH_ERROR_CODES.find((c) => c === raw) ?? null;
}
