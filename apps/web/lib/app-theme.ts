'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { storageSet } from '@/lib/safe-storage';

/**
 * Tema claro / noche de la plataforma nueva (`.gsApp`, `gs-tokens.css`).
 *
 * - Sin elección guardada manda el sistema (`prefers-color-scheme`): <html> no lleva atributo.
 * - Con elección, <html data-gs-theme="light|dark">, guardada con `safe-storage`.
 * - Sin parpadeo: `APP_BOOT_SCRIPT` corre inline en el <head> del layout de la plataforma,
 *   antes del primer pintado, y pone el tema guardado y el idioma (`lang`).
 */
export type AppTheme = 'light' | 'dark';

export const APP_THEME_KEY = 'gs_theme';
/** La misma clave que usa `LanguageContext`. */
const LANGUAGE_KEY = 'gs_language';

/**
 * Script inline mínimo (sin dependencias). Va en el <head>, por eso no puede importar nada:
 * lee el tema y el idioma guardados y los aplica a <html>. Si el almacenamiento está
 * bloqueado, no hace nada (manda el sistema y `lang` queda como lo pintó el servidor).
 */
export const APP_BOOT_SCRIPT = `(function(){try{var d=document.documentElement,s=window.localStorage,t=s.getItem('${APP_THEME_KEY}');if(t==='light'||t==='dark')d.setAttribute('data-gs-theme',t);var l=s.getItem('${LANGUAGE_KEY}');if(l!=='es'&&l!=='en'){l=(navigator.language||'').toLowerCase().indexOf('es')===0?'es':'en'}d.lang=l}catch(e){}})();`;

const DARK_QUERY = '(prefers-color-scheme: dark)';

function readTheme(): AppTheme {
  const attr = document.documentElement.getAttribute('data-gs-theme');
  if (attr === 'light' || attr === 'dark') return attr;
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener('change', listener);
  return () => {
    listeners.delete(listener);
    media.removeEventListener('change', listener);
  };
}

/** Tema efectivo y una función para fijarlo. En el servidor devuelve `null` (aún no se sabe). */
export function useAppTheme(): { theme: AppTheme | null; setTheme: (theme: AppTheme) => void } {
  const theme = useSyncExternalStore<AppTheme | null>(subscribe, readTheme, () => null);

  const setTheme = useCallback((next: AppTheme) => {
    document.documentElement.setAttribute('data-gs-theme', next);
    storageSet(APP_THEME_KEY, next);
    listeners.forEach((l) => l());
  }, []);

  return { theme, setTheme };
}
