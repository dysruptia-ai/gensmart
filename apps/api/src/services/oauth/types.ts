/**
 * Proveedores de ingreso externo (web-38). Cada proveedor es una pieza intercambiable que solo sabe
 * armar la URL de autorización y cambiar el `code` por una identidad verificada. Vincular, entrar y
 * registrar viven en `social-auth.service.ts`, igual para todos.
 */

/** Proveedores conocidos. Hoy solo Google; Microsoft y LinkedIn se agregan aquí y en `registry.ts`. */
export type OAuthProviderId = 'google';

/** Lo que el proveedor garantiza de la persona, ya verificado (firma, emisor, audiencia, nonce). */
export interface OAuthIdentity {
  /** Identificador estable de la persona en el proveedor (no el correo, que puede cambiar). */
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
}

export interface BuildAuthUrlInput {
  state: string;
  nonce: string;
  /** Desafío PKCE S256 (el verificador se queda en el servidor). */
  codeChallenge: string;
  /** Idioma de la pantalla del proveedor (`hl`), si lo admite. */
  lang?: 'es' | 'en';
}

export interface ExchangeInput {
  code: string;
  codeVerifier: string;
  /** El nonce guardado al iniciar: el ID token debe traer el mismo. */
  nonce: string;
}

export interface OAuthProvider {
  id: OAuthProviderId;
  /** Nombre visible (correos, avisos). */
  label: string;
  /** Falso si faltan sus credenciales en el entorno. */
  isConfigured(): boolean;
  buildAuthUrl(input: BuildAuthUrlInput): string;
  /** Cambia el `code` por tokens y verifica el ID token. Lanza `OAuthVerificationError` si algo no cuadra. */
  exchangeAndVerify(input: ExchangeInput): Promise<OAuthIdentity>;
}

/** Falla al verificar la respuesta del proveedor. El mensaje es para el log y nunca incluye tokens. */
export class OAuthVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OAuthVerificationError';
  }
}
