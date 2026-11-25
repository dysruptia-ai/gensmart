/**
 * Rutas de las páginas legales: id, clave del registro y slug por idioma.
 * Liviano a propósito (lo usan `site-routes`, `proxy.ts` y los enlaces). El texto está
 * en `content/legal/{es,en}/<slug>.md`, que lee `lib/legal.ts` solo en el servidor;
 * el `id` y el `slug` del frontmatter tienen que coincidir con estos.
 */
export type LegalId = 'privacy' | 'terms' | 'cookies';

/** Id de página del registro de rutas (también es la clave de `SITE_LINKS`). */
export type LegalRouteId = 'legalPrivacy' | 'legalTerms' | 'legalCookies';

export interface LegalRoute {
  id: LegalId;
  routeId: LegalRouteId;
  slug: { es: string; en: string };
}

/** Orden en que se listan entre sí (y en el pie). */
export const LEGAL_ROUTES: readonly LegalRoute[] = [
  { id: 'privacy', routeId: 'legalPrivacy', slug: { es: 'politica-de-privacidad', en: 'privacy-policy' } },
  { id: 'terms', routeId: 'legalTerms', slug: { es: 'terminos-del-servicio', en: 'terms-of-service' } },
  { id: 'cookies', routeId: 'legalCookies', slug: { es: 'politica-de-cookies', en: 'cookie-policy' } },
];
