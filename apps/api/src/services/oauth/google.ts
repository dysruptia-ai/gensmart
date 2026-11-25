import { OAuth2Client } from 'google-auth-library';
import { env } from '../../config/env';
import { OAuthVerificationError, type OAuthIdentity, type OAuthProvider } from './types';

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);

/** Lo que usamos de la librería: permite reemplazarla por un doble en los tests. */
export interface GoogleOAuthClient {
  getToken(options: { code: string; codeVerifier?: string }): Promise<{ tokens: { id_token?: string | null } }>;
  verifyIdToken(options: { idToken: string; audience: string }): Promise<{ getPayload(): GoogleIdTokenPayload | undefined }>;
}

/** Campos del ID token de Google que revisamos. */
export interface GoogleIdTokenPayload {
  iss: string;
  aud: string | string[];
  sub: string;
  exp: number;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  nonce?: string;
}

export interface GoogleProviderConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export function googleRedirectUri(): string {
  return env.GOOGLE_REDIRECT_URI || `${env.API_URL.replace(/\/$/, '')}/api/auth/google/callback`;
}

/**
 * Revisa el contenido del ID token. La firma, la audiencia y la expiración ya las verificó
 * `verifyIdToken` de google-auth-library; aquí se repiten las comprobaciones baratas (defensa en
 * profundidad) y se agregan las que la librería no hace: el nonce y los campos que necesitamos.
 */
export function identityFromGooglePayload(
  payload: GoogleIdTokenPayload | undefined,
  expected: { clientId: string; nonce: string; nowSeconds?: number }
): OAuthIdentity {
  if (!payload) throw new OAuthVerificationError('ID token without payload');
  if (!GOOGLE_ISSUERS.has(payload.iss)) throw new OAuthVerificationError('Unexpected issuer');
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(expected.clientId)) throw new OAuthVerificationError('Unexpected audience');
  const now = expected.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp <= now) throw new OAuthVerificationError('ID token expired');
  if (!payload.nonce || payload.nonce !== expected.nonce) throw new OAuthVerificationError('Nonce mismatch');
  if (!payload.sub) throw new OAuthVerificationError('ID token without sub');
  if (!payload.email) throw new OAuthVerificationError('ID token without email');
  const email = payload.email.toLowerCase();
  return {
    sub: payload.sub,
    email,
    emailVerified: payload.email_verified === true,
    name: (payload.name || payload.given_name || email.split('@')[0]).trim().slice(0, 100),
  };
}

export function createGoogleProvider(
  config: () => GoogleProviderConfig = () => ({
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: googleRedirectUri(),
  }),
  clientFactory: (c: GoogleProviderConfig) => GoogleOAuthClient = (c) =>
    new OAuth2Client({ clientId: c.clientId, clientSecret: c.clientSecret, redirectUri: c.redirectUri })
): OAuthProvider {
  return {
    id: 'google',
    label: 'Google',
    isConfigured() {
      const c = config();
      return Boolean(c.clientId && c.clientSecret);
    },
    buildAuthUrl({ state, nonce, codeChallenge, lang }) {
      const c = config();
      const params = new URLSearchParams({
        client_id: c.clientId,
        redirect_uri: c.redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        state,
        nonce,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        prompt: 'select_account',
      });
      if (lang) params.set('hl', lang);
      return `${AUTH_ENDPOINT}?${params.toString()}`;
    },
    async exchangeAndVerify({ code, codeVerifier, nonce }) {
      const c = config();
      const client = clientFactory(c);
      let idToken: string | null | undefined;
      try {
        ({ tokens: { id_token: idToken } } = await client.getToken({ code, codeVerifier }));
      } catch {
        // El error de la librería puede traer la respuesta de Google: no se propaga ni se registra
        throw new OAuthVerificationError('Token exchange failed');
      }
      if (!idToken) throw new OAuthVerificationError('No ID token in the token response');
      let payload: GoogleIdTokenPayload | undefined;
      try {
        const ticket = await client.verifyIdToken({ idToken, audience: c.clientId });
        payload = ticket.getPayload();
      } catch {
        throw new OAuthVerificationError('ID token verification failed');
      }
      return identityFromGooglePayload(payload, { clientId: c.clientId, nonce });
    },
  };
}

export const googleProvider = createGoogleProvider();
