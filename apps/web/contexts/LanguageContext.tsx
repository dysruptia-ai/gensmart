'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { counterpart } from '@/lib/site-routes';
import { useAuth } from '@/contexts/AuthContext';
import { storageGet, storageSet } from '@/lib/safe-storage';

export type SupportedLanguage = 'en' | 'es';

interface LanguageContextValue {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  /** false hasta que el efecto aplica el idioma real tras la hidratación */
  isLanguageResolved: boolean;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const LS_KEY = 'gs_language';

/** useLayoutEffect en el navegador; en el servidor no corre (y no avisa). */
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

function detectBrowserLanguage(): SupportedLanguage {
  if (typeof navigator === 'undefined') return 'en';
  const lang = navigator.language || '';
  return lang.startsWith('es') ? 'es' : 'en';
}

function getInitialLanguage(userLanguage?: string): SupportedLanguage {
  // 1. User's saved preference
  if (userLanguage === 'en' || userLanguage === 'es') {
    return userLanguage;
  }
  // 2. LocalStorage for guests
  if (typeof window !== 'undefined') {
    const stored = storageGet(LS_KEY);
    if (stored === 'en' || stored === 'es') return stored;
  }
  // 3. Browser language
  return detectBrowserLanguage();
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  // El servidor no conoce el idioma: el primer render es 'en' (igual que el HTML del servidor).
  // Se resuelve en un layout effect, que corre después de hidratar y ANTES de pintar: el
  // usuario nunca ve los textos en un idioma distinto del que puso el script del <head>
  // (lib/app-theme.ts), que decide con la misma regla (gs_language → navegador).
  const [language, setLanguageState] = useState<SupportedLanguage>('en');
  const [isLanguageResolved, setIsLanguageResolved] = useState(false);
  const userLanguage = (user as { language?: string } | null)?.language;

  useIsomorphicLayoutEffect(() => {
    // Prioridad: idioma del usuario con sesión → gs_language → navegador
    const lang = getInitialLanguage(userLanguage);
    setLanguageState(lang);
    storageSet(LS_KEY, lang);
    document.documentElement.lang = lang;
    setIsLanguageResolved(true);
  }, [userLanguage]);

  // <html lang> sigue al idioma activo (lectores de pantalla). Solo cuando ya está resuelto:
  // antes, el script del <head> (lib/app-theme.ts) ya puso el idioma guardado.
  useIsomorphicLayoutEffect(() => {
    if (isLanguageResolved) document.documentElement.lang = language;
  }, [language, isLanguageResolved]);

  const setLanguage = useCallback(
    (lang: SupportedLanguage) => {
      setLanguageState(lang);
      if (typeof window !== 'undefined') {
        storageSet(LS_KEY, lang);
      }
      // Persist to backend if authenticated
      if (user) {
        api.put('/api/auth/me', { language: lang }).catch(() => {
          // Non-critical — language is already updated in UI
        });
      }
    },
    [user]
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, isLanguageResolved }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside <LanguageProvider>');
  return ctx;
}

/**
 * Idioma fijo para el sitio público con rutas por idioma (`app/(site)/[lang]`).
 * El idioma sale de la URL: está resuelto desde el primer render (también en el servidor)
 * y no depende de AuthProvider. `setLanguage` navega a la misma página en el otro idioma.
 */
export function FixedLanguageProvider({
  language,
  children,
}: {
  language: SupportedLanguage;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  // El registro y las páginas viejas abren en el idioma que el visitante estaba leyendo
  useEffect(() => {
    storageSet(LS_KEY, language);
  }, [language]);

  const setLanguage = useCallback(
    (lang: SupportedLanguage) => {
      if (lang === language) return;
      const target = counterpart(pathname);
      if (target) router.push(target.path);
    },
    [language, pathname, router]
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, isLanguageResolved: true }}>
      {children}
    </LanguageContext.Provider>
  );
}
