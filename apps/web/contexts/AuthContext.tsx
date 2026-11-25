'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { api, setAccessToken, ApiError } from '@/lib/api';
import type { WelcomeSurveyStatus } from '@gensmart/shared';
import { disconnectSharedSocket, useWebSocket, type WebSocketEvents } from '@/hooks/useWebSocket';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  orgId: string;
  orgName: string;
  orgIsSuspended: boolean;
  orgTrialEndsAt: string | null;
  totpEnabled: boolean;
  language: string;
  isSuperAdmin: boolean;
  /** Cuestionario de bienvenida (web-37): `pending` = el ingreso manda a /welcome. No es el tour guiado. */
  welcomeSurvey: WelcomeSurveyStatus;
}

export interface OAuthSignupOptions {
  token: string;
  name: string;
  organizationName: string;
  acceptTerms: boolean;
  promoCode?: string;
  language?: 'es' | 'en';
}

interface LoginResult {
  requires2FA?: boolean;
  tempToken?: string;
  user?: AuthUser;
}

interface RegisterResult {
  email: string;
  promoApplied: boolean;
}

interface RegisterOptions {
  email: string;
  password: string;
  name: string;
  organizationName: string;
  turnstileToken: string;
  promoCode?: string;
  plan?: string;
  /** Casilla de Términos y Privacidad: la API exige `true`. */
  acceptTerms: boolean;
  /** Idioma activo de la pantalla: queda en users.language. */
  language?: 'es' | 'en';
  /** `?ref=` del enlace (atribución de socios), ya filtrado por `signupRefSchema`. */
  ref?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** Convenience alias for user?.orgIsSuspended ?? false — gates mutation buttons across the dashboard. */
  isSuspended: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  verify2FA: (tempToken: string, code: string) => Promise<AuthUser>;
  /** Completa el registro con un proveedor (web-38): crea la cuenta y deja la sesión abierta. */
  completeOAuthSignup: (options: OAuthSignupOptions) => Promise<{ user: AuthUser; from: string }>;
  register: (options: RegisterOptions) => Promise<RegisterResult>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthResponse {
  accessToken: string;
  user: AuthUser;
  requires2FA?: boolean;
  tempToken?: string;
}

// How many ms before expiry to refresh (1 min = 60_000ms; access token is 15min)
const REFRESH_BEFORE_EXPIRY_MS = 60_000;
const ACCESS_TOKEN_LIFETIME_MS = 14 * 60_000; // refresh at 14 min

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { on, off } = useWebSocket();

  // Flips orgIsSuspended immediately on the real-time event, instead of waiting for the next
  // silent refresh — the cron/Stripe webhook notify every open tab of the affected org.
  useEffect(() => {
    const handleSuspended: WebSocketEvents['org:suspended'] = () => {
      setUser((prev) => (prev ? { ...prev, orgIsSuspended: true } : prev));
    };
    const handleReactivated: WebSocketEvents['org:reactivated'] = () => {
      setUser((prev) => (prev ? { ...prev, orgIsSuspended: false } : prev));
    };
    on('org:suspended', handleSuspended);
    on('org:reactivated', handleReactivated);
    // Also triggered by lib/api.ts on a 403 ORG_SUSPENDED response, in case the WS event is
    // delayed or the socket is disconnected.
    const handleDomEvent = () => handleSuspended({ reason: 'api_403' });
    window.addEventListener('org:suspended', handleDomEvent);
    return () => {
      off('org:suspended', handleSuspended);
      off('org:reactivated', handleReactivated);
      window.removeEventListener('org:suspended', handleDomEvent);
    };
  }, [on, off]);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(async () => {
      try {
        const data = await api.post<AuthResponse>('/api/auth/refresh');
        setAccessToken(data.accessToken);
        setUser(data.user);
        scheduleRefresh();
      } catch {
        setUser(null);
        setAccessToken(null);
        disconnectSharedSocket();
      }
    }, ACCESS_TOKEN_LIFETIME_MS - REFRESH_BEFORE_EXPIRY_MS);
  }, []);

  // Silent refresh on mount to restore session
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.post<AuthResponse>('/api/auth/refresh');
        if (!cancelled) {
          setAccessToken(data.accessToken);
          setUser(data.user);
          scheduleRefresh();
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          setAccessToken(null);
          disconnectSharedSocket();
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [scheduleRefresh]);

  const login = useCallback(
    async (email: string, password: string): Promise<LoginResult> => {
      const data = await api.post<AuthResponse>('/api/auth/login', { email, password });
      if (data.requires2FA) {
        return { requires2FA: true, tempToken: data.tempToken };
      }
      setAccessToken(data.accessToken);
      setUser(data.user);
      scheduleRefresh();
      return { user: data.user };
    },
    [scheduleRefresh]
  );

  const verify2FA = useCallback(
    async (tempToken: string, code: string): Promise<AuthUser> => {
      const data = await api.post<AuthResponse>('/api/auth/2fa/verify', { tempToken, code });
      setAccessToken(data.accessToken);
      setUser(data.user);
      scheduleRefresh();
      return data.user;
    },
    [scheduleRefresh]
  );

  const completeOAuthSignup = useCallback(
    async (options: OAuthSignupOptions): Promise<{ user: AuthUser; from: string }> => {
      const data = await api.post<AuthResponse & { from: string }>('/api/auth/oauth/complete', {
        token: options.token,
        name: options.name,
        organizationName: options.organizationName,
        acceptTerms: options.acceptTerms,
        ...(options.promoCode ? { promoCode: options.promoCode } : {}),
        ...(options.language ? { language: options.language } : {}),
      });
      setAccessToken(data.accessToken);
      setUser(data.user);
      scheduleRefresh();
      return { user: data.user, from: data.from };
    },
    [scheduleRefresh]
  );

  const register = useCallback(
    async (options: RegisterOptions): Promise<RegisterResult> => {
      const { email, password, name, organizationName, turnstileToken, promoCode, plan, acceptTerms, ref, language } = options;
      // No session is created: the account becomes usable once the emailed link is confirmed
      const data = await api.post<{ message: string; email: string; promoApplied: boolean }>('/api/auth/register', {
        email,
        password,
        name,
        organizationName,
        turnstileToken,
        acceptTerms,
        ...(language ? { language } : {}),
        ...(promoCode ? { promoCode } : {}),
        ...(plan ? { plan } : {}),
        ...(ref ? { ref } : {}),
      });
      return { email: data.email, promoApplied: data.promoApplied };
    },
    []
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      await api.post('/api/auth/logout');
    } catch (err) {
      // ignore logout errors — clear state regardless
      if (!(err instanceof ApiError)) console.error(err);
    } finally {
      setAccessToken(null);
      disconnectSharedSocket();
      setUser(null);
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    }
  }, []);

  const refreshUser = useCallback(async (): Promise<void> => {
    const data = await api.post<AuthResponse>('/api/auth/refresh');
    setAccessToken(data.accessToken);
    setUser(data.user);
  }, []);


  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        isSuspended: user?.orgIsSuspended ?? false,
        login,
        verify2FA,
        completeOAuthSignup,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
