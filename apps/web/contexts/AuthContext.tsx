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

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  orgId: string;
  orgName: string;
  totpEnabled: boolean;
  language: string;
  onboardingCompleted: boolean;
  onboardingStep: number;
  editorTourCompleted: boolean;
}

interface LoginResult {
  requires2FA?: boolean;
  tempToken?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  verify2FA: (tempToken: string, code: string) => Promise<void>;
  register: (email: string, password: string, name: string, organizationName: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateOnboarding: (step?: number, completed?: boolean, editorTourCompleted?: boolean) => Promise<void>;
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
      return {};
    },
    [scheduleRefresh]
  );

  const verify2FA = useCallback(
    async (tempToken: string, code: string): Promise<void> => {
      const data = await api.post<AuthResponse>('/api/auth/2fa/verify', { tempToken, code });
      setAccessToken(data.accessToken);
      setUser(data.user);
      scheduleRefresh();
    },
    [scheduleRefresh]
  );

  const register = useCallback(
    async (email: string, password: string, name: string, organizationName: string): Promise<void> => {
      const data = await api.post<AuthResponse>('/api/auth/register', {
        email,
        password,
        name,
        organizationName,
      });
      setAccessToken(data.accessToken);
      setUser(data.user);
      scheduleRefresh();
    },
    [scheduleRefresh]
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      await api.post('/api/auth/logout');
    } catch (err) {
      // ignore logout errors — clear state regardless
      if (!(err instanceof ApiError)) console.error(err);
    } finally {
      setAccessToken(null);
      setUser(null);
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    }
  }, []);

  const refreshUser = useCallback(async (): Promise<void> => {
    const data = await api.post<AuthResponse>('/api/auth/refresh');
    setAccessToken(data.accessToken);
    setUser(data.user);
  }, []);

  const updateOnboarding = useCallback(async (step?: number, completed?: boolean, editorTourCompleted?: boolean): Promise<void> => {
    await api.put('/api/auth/onboarding', { step, completed, editorTourCompleted });
    setUser((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        onboardingCompleted: completed === true ? true : (completed === false ? false : prev.onboardingCompleted),
        onboardingStep: completed === true ? 0 : (step !== undefined ? step : prev.onboardingStep),
        editorTourCompleted: editorTourCompleted !== undefined ? editorTourCompleted : prev.editorTourCompleted,
      };
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        verify2FA,
        register,
        logout,
        refreshUser,
        updateOnboarding,
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
