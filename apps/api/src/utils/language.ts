import type { Request } from 'express';
import type { UserLanguage } from '@gensmart/shared';

/** Idioma por defecto de un usuario nuevo sin pantalla: `es` si Accept-Language empieza por `es`, si no `en`. */
export function languageFromRequest(req: Pick<Request, 'headers'>): UserLanguage {
  const header = req.headers['accept-language'];
  const first = (Array.isArray(header) ? header[0] : header) ?? '';
  return first.trim().toLowerCase().startsWith('es') ? 'es' : 'en';
}

/** El idioma que mandó la pantalla, o el de la cabecera. */
export function resolveUserLanguage(sent: UserLanguage | undefined, req: Pick<Request, 'headers'>): UserLanguage {
  return sent ?? languageFromRequest(req);
}
