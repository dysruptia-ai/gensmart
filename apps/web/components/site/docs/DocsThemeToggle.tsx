'use client';

import { useLayoutEffect, useSyncExternalStore } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import styles from './DocsThemeToggle.module.css';

const STORAGE_KEY = 'gs-docs-theme';
const ATTR = 'data-docs-theme';
const EVENT = 'gs-docs-theme';

/** El tema vive en un atributo de <html> (lo pone el script inline del shell antes de pintar). */
function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

const isLight = () => document.documentElement.getAttribute(ATTR) === 'light';

function applyTheme(light: boolean): void {
  if (light) document.documentElement.setAttribute(ATTR, 'light');
  else document.documentElement.removeAttribute(ATTR);
  window.dispatchEvent(new Event(EVENT));
}

function storedLight(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'light';
  } catch {
    return isLight();
  }
}

/**
 * Botón de modo claro de la base de conocimiento (design/web: `dxTheme`).
 * Interruptor con nombre fijo ("Modo claro") y `aria-pressed`: el diseño cambiaba el texto
 * con el estado, lo que deja nombre y estado en contradicción para un lector de pantalla.
 */
export default function DocsThemeToggle() {
  const { t } = useTranslation();
  const light = useSyncExternalStore(subscribe, isLight, () => false);

  // Antes de pintar: en la navegación del cliente el script inline no vuelve a correr
  useLayoutEffect(() => {
    applyTheme(storedLight());
  }, []);

  const toggle = () => {
    const next = !light;
    applyTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? 'light' : 'dark');
    } catch {
      // Sin almacenamiento (modo privado estricto): el cambio vale para esta página
    }
  };

  return (
    <button type="button" className={styles.toggle} aria-pressed={light} title={t('site.docs.theme.label')} onClick={toggle}>
      {light ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
      <span>{t('site.docs.theme.light')}</span>
    </button>
  );
}
