'use client';

import { useCallback, useEffect, useRef } from 'react';
import Script from 'next/script';

interface TurnstileApi {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  reset: (widgetId?: string) => void;
  remove?: (widgetId?: string) => void;
}

/** API global de Turnstile, tipada aquí (el registro declara su propia versión en `Window`). */
function turnstileApi(): TurnstileApi | undefined {
  return (window as unknown as { turnstile?: TurnstileApi }).turnstile;
}

/** Site key pública de Turnstile (la misma del registro). Vacía = sin captcha (local). */
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

interface TurnstileFieldProps {
  /** Token nuevo, o `''` cuando expira o falla. */
  onToken: (token: string) => void;
  /** Cambiarlo pide un token nuevo (los tokens son de un solo uso). */
  resetKey: number;
  language: 'es' | 'en';
  className?: string;
}

/**
 * Widget de Cloudflare Turnstile para los formularios del sitio público
 * (Contacto y "Hablar con ventas"). Sin `NEXT_PUBLIC_TURNSTILE_SITE_KEY` no pinta nada.
 */
export default function TurnstileField({ onToken, resetKey, language, className }: TurnstileFieldProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | undefined>(undefined);
  const onTokenRef = useRef(onToken);
  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  const render = useCallback(() => {
    const api = turnstileApi();
    if (!TURNSTILE_SITE_KEY || !boxRef.current || !api || widgetIdRef.current) return;
    widgetIdRef.current = api.render(boxRef.current, {
      sitekey: TURNSTILE_SITE_KEY,
      language,
      theme: 'dark',
      callback: (token: string) => onTokenRef.current(token),
      'error-callback': () => onTokenRef.current(''),
      'expired-callback': () => onTokenRef.current(''),
    });
  }, [language]);

  // Si el script ya estaba cargado (otro formulario o navegación), `onReady` no vuelve a sonar
  useEffect(() => {
    render();
    return () => {
      const api = turnstileApi();
      if (widgetIdRef.current && api?.remove) api.remove(widgetIdRef.current);
      widgetIdRef.current = undefined;
    };
  }, [render]);

  useEffect(() => {
    if (resetKey === 0) return;
    const api = turnstileApi();
    if (api && widgetIdRef.current) api.reset(widgetIdRef.current);
    onTokenRef.current('');
  }, [resetKey]);

  if (!TURNSTILE_SITE_KEY) return null;

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={render}
      />
      <div ref={boxRef} className={className} />
    </>
  );
}
