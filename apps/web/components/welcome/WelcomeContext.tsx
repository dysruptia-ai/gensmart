'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { WelcomeAnswers, WelcomeSurveyPatch, WelcomeSurveyState, WelcomeSurveyStatus } from '@gensmart/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { safeFrom } from '@/components/auth/authForm';
import { EMPTY_ANSWERS } from './welcome-data';

interface WelcomeContextValue {
  phase: 'loading' | 'ready' | 'error';
  status: WelcomeSurveyStatus;
  /** Respuestas en pantalla (se guardan al avanzar). El panel las lee en vivo. */
  answers: WelcomeAnswers;
  setAnswers: (patch: Partial<WelcomeAnswers>) => void;
  refCode: string | null;
  /** Ruta interna a la que se vuelve al terminar u omitir (por defecto `/dashboard`). */
  from: string;
  stepHref: (step: number | 'done') => string;
  /** Guarda en la API (PATCH parcial). Lanza si falla. */
  save: (patch: WelcomeSurveyPatch) => Promise<void>;
  reload: () => void;
}

const WelcomeContext = createContext<WelcomeContextValue | null>(null);

/**
 * Estado del cuestionario de bienvenida para todos los pasos (el layout no se desmonta entre
 * pasos, así que lo contestado sobrevive a "Atrás" y al cambio de URL). La decisión de mostrarlo
 * se toma al ingresar (login); aquí solo se protege la ruta: si ya no le toca, va al panel.
 */
export function WelcomeProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading } = useAuth();
  const [phase, setPhase] = useState<WelcomeContextValue['phase']>('loading');
  const [state, setState] = useState<WelcomeSurveyState>({ status: 'pending', answers: EMPTY_ANSWERS, refCode: null });
  const [attempt, setAttempt] = useState(0);
  const checked = useRef(false);
  const [from] = useState(() => safeFrom(searchParams.get('from')));

  useEffect(() => {
    if (isLoading || checked.current) return;
    if (!user) {
      router.replace('/login?from=%2Fwelcome');
      return;
    }
    if (user.welcomeSurvey === 'none') {
      checked.current = true;
      router.replace('/dashboard');
      return;
    }
    let cancelled = false;
    api
      .get<WelcomeSurveyState>('/api/organization/onboarding')
      .then((data) => {
        if (cancelled) return;
        checked.current = true;
        if (data.status !== 'pending') {
          router.replace('/dashboard');
          return;
        }
        setState(data);
        setPhase('ready');
      })
      .catch(() => {
        if (!cancelled) setPhase('error');
      });
    return () => {
      cancelled = true;
    };
  }, [isLoading, user, router, attempt]);

  const setAnswers = useCallback((patch: Partial<WelcomeAnswers>) => {
    setState((prev) => ({ ...prev, answers: { ...prev.answers, ...patch } }));
  }, []);

  const save = useCallback(async (patch: WelcomeSurveyPatch) => {
    const data = await api.patch<WelcomeSurveyState>('/api/organization/onboarding', patch);
    setState(data);
  }, []);

  const stepHref = useCallback(
    (step: number | 'done') => `/welcome/${step}${from === '/dashboard' ? '' : `?from=${encodeURIComponent(from)}`}`,
    [from]
  );

  const reload = useCallback(() => {
    setPhase('loading');
    setAttempt((n) => n + 1);
  }, []);

  return (
    <WelcomeContext.Provider
      value={{
        phase,
        status: state.status,
        answers: state.answers,
        setAnswers,
        refCode: state.refCode,
        from,
        stepHref,
        save,
        reload,
      }}
    >
      {children}
    </WelcomeContext.Provider>
  );
}

export function useWelcome(): WelcomeContextValue {
  const ctx = useContext(WelcomeContext);
  if (!ctx) throw new Error('useWelcome must be used inside <WelcomeProvider>');
  return ctx;
}
