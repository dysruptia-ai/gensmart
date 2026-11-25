'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { useAppTheme } from '@/lib/app-theme';
import type { SupportedLanguage } from '@/contexts/LanguageContext';
import styles from './AppTurnstile.module.css';

interface TurnstileApi {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  reset: (widgetId?: string) => void;
  remove?: (widgetId?: string) => void;
}

function turnstileApi(): TurnstileApi | undefined {
  return (window as unknown as { turnstile?: TurnstileApi }).turnstile;
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

export interface AppTurnstileProps {
  /** Token nuevo, o `''` cuando expira o falla. */
  onToken: (token: string) => void;
  /** Cambiarlo pide un token nuevo (los tokens son de un solo uso). */
  resetKey: number;
  language: SupportedLanguage;
  /** Nombre accesible de la zona. */
  label: string;
  error?: string;
  errorId?: string;
}

/**
 * Cloudflare Turnstile para la plataforma. Sigue el tema claro/noche activo: al cambiarlo se
 * vuelve a pintar (pide un token nuevo). Sin `NEXT_PUBLIC_TURNSTILE_SITE_KEY` no pinta nada.
 */
export default function AppTurnstile({ onToken, resetKey, language, label, error, errorId }: AppTurnstileProps) {
  const { theme } = useAppTheme();
  const boxRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | undefined>(undefined);
  // `onReady` del <Script> se registra una vez: si llamara a `render` directamente, usaría la
  // versión del primer render (tema aún sin resolver) y el widget no se pintaría nunca
  const [scriptReady, setScriptReady] = useState(false);
  const onTokenRef = useRef(onToken);
  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  const render = useCallback(() => {
    const api = turnstileApi();
    if (!SITE_KEY || !boxRef.current || !api || widgetIdRef.current || !theme) return;
    widgetIdRef.current = api.render(boxRef.current, {
      sitekey: SITE_KEY,
      language,
      theme,
      size: 'flexible',
      callback: (token: string) => onTokenRef.current(token),
      'error-callback': () => onTokenRef.current(''),
      'expired-callback': () => onTokenRef.current(''),
    });
  }, [language, theme]);

  useEffect(() => {
    if (!scriptReady && !turnstileApi()) return;
    render();
    return () => {
      const api = turnstileApi();
      if (widgetIdRef.current && api?.remove) api.remove(widgetIdRef.current);
      widgetIdRef.current = undefined;
      onTokenRef.current('');
    };
  }, [render, scriptReady]);

  useEffect(() => {
    if (resetKey === 0) return;
    const api = turnstileApi();
    if (api && widgetIdRef.current) api.reset(widgetIdRef.current);
    onTokenRef.current('');
  }, [resetKey]);

  if (!SITE_KEY) return null;

  return (
    <div className={styles.wrap}>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
      />
      <div ref={boxRef} className={styles.box} role="group" aria-label={label} aria-describedby={error ? errorId : undefined} />
      {error && (
        <p className={styles.error} id={errorId}>
          {error}
        </p>
      )}
    </div>
  );
}
