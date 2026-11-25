import { googleProvider } from './google';
import type { OAuthProvider, OAuthProviderId } from './types';

/** Proveedores disponibles. Para sumar uno: su archivo con `OAuthProvider`, su id en `types.ts` y una línea aquí. */
const PROVIDERS: Record<OAuthProviderId, OAuthProvider> = {
  google: googleProvider,
};

export function getOAuthProvider(id: string): OAuthProvider | null {
  return Object.prototype.hasOwnProperty.call(PROVIDERS, id) ? PROVIDERS[id as OAuthProviderId] : null;
}
