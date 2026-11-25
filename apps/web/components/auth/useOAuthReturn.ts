'use client';

import { useEffect } from 'react';
import type { ReadonlyURLSearchParams } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { parseOAuthError, type OAuthErrorCode } from '@/lib/oauth-links';

/**
 * Al volver del proveedor, la API deja `lang` (el idioma de la pantalla desde la que salió) y, si
 * algo falló, `oauth_error`. Aplica ese idioma y devuelve el aviso a mostrar.
 */
export function useOAuthReturn(searchParams: ReadonlyURLSearchParams): OAuthErrorCode | null {
  const { language, setLanguage, isLanguageResolved } = useLanguage();
  const lang = searchParams.get('lang');
  useEffect(() => {
    if (isLanguageResolved && (lang === 'es' || lang === 'en') && lang !== language) setLanguage(lang);
    // Solo al llegar: si después la persona cambia el idioma, no se vuelve a forzar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, isLanguageResolved]);
  return parseOAuthError(searchParams.get('oauth_error'));
}
