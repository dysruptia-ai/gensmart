'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

/** Panel oscuro de la derecha: solo en el ingreso y el registro (no en los pasos de apoyo). */
export type AuthPanelVariant = 'login' | 'register' | null;

interface AuthScreenContextValue {
  panel: AuthPanelVariant;
  setPanel: (panel: AuthPanelVariant) => void;
}

const AuthScreenContext = createContext<AuthScreenContextValue | null>(null);

function panelForPath(pathname: string): AuthPanelVariant {
  if (pathname === '/login') return 'login';
  if (pathname === '/register') return 'register';
  return null;
}

export function AuthScreenProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Desde el primer render (también en el servidor) el panel sale de la ruta: sin saltos al cargar
  const [override, setOverride] = useState<{ path: string; panel: AuthPanelVariant } | null>(null);
  const panel = override && override.path === pathname ? override.panel : panelForPath(pathname);
  const setPanel = React.useCallback((p: AuthPanelVariant) => setOverride({ path: pathname, panel: p }), [pathname]);
  return <AuthScreenContext.Provider value={{ panel, setPanel }}>{children}</AuthScreenContext.Provider>;
}

export function useAuthPanel(): AuthPanelVariant {
  const ctx = useContext(AuthScreenContext);
  return ctx?.panel ?? null;
}

/**
 * Cada pantalla (o paso) declara su título del documento y si lleva el panel.
 * El título se escribe en el idioma activo (el servidor solo conoce el inglés).
 */
export function useAuthScreen({ title, panel }: { title: string; panel: AuthPanelVariant }): void {
  const ctx = useContext(AuthScreenContext);
  const setPanel = ctx?.setPanel;
  useEffect(() => {
    setPanel?.(panel);
  }, [panel, setPanel]);
  useEffect(() => {
    const wanted = `${title} | GenSmart`;
    const apply = () => {
      if (document.title !== wanted) document.title = wanted;
    };
    apply();
    // Next escribe el <title> de la metadata (en inglés) cuando termina de transmitirla, a veces
    // después de este efecto: mientras la pantalla esté montada, se vuelve a poner el del idioma activo
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [title]);
}
