'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export type SupportedLanguage = 'en' | 'es';

interface LanguageContextValue {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const LS_KEY = 'gs_language';

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
    const stored = localStorage.getItem(LS_KEY);
    if (stored === 'en' || stored === 'es') return stored;
  }
  // 3. Browser language
  return detectBrowserLanguage();
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  // Start with 'en' to match SSR — prevents hydration mismatch.
  // Real language is applied in useEffect after hydration completes.
  const [language, setLanguageState] = useState<SupportedLanguage>('en');
  const [hydrated, setHydrated] = useState(false);

  // Mark as hydrated after first client render
  useEffect(() => {
    setHydrated(true);
  }, []);

  // Sync language AFTER hydration to avoid mismatch
  useEffect(() => {
    if (!hydrated) return;
    const lang = getInitialLanguage((user as { language?: string } | null)?.language);
    setLanguageState(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem(LS_KEY, lang);
    }
  }, [hydrated, user]);

  const setLanguage = useCallback(
    (lang: SupportedLanguage) => {
      setLanguageState(lang);
      if (typeof window !== 'undefined') {
        localStorage.setItem(LS_KEY, lang);
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
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside <LanguageProvider>');
  return ctx;
}
