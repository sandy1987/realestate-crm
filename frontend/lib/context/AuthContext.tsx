'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserSummary } from '@/types/user';
import { LoginCredentials, AuthState } from '@/types/auth';
import { authApi } from '@/lib/api/auth';
import { tokenManager } from '@/lib/api/tokenManager';

export interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  loadCurrentUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSummary | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(() => tokenManager.hasTokens());

  // Sync token state from TokenManager
  useEffect(() => {
    const unsubTokens = tokenManager.onTokenUpdate(({ accessToken: at, refreshToken: rt }) => {
      setAccessToken(at);
      setRefreshToken(rt);
    });

    const unsubExpired = tokenManager.onAuthExpired(() => {
      setUser(null);
      setAccessToken(null);
      setRefreshToken(null);
      setIsLoading(false);
    });

    return () => {
      unsubTokens();
      unsubExpired();
    };
  }, []);

  // Fetch current authenticated user profile
  const loadCurrentUser = useCallback(async () => {
    if (!tokenManager.hasTokens()) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const profile = await authApi.getMe();
      setUser(profile);
    } catch {
      // getMe failed (e.g. account disabled or token invalid)
      tokenManager.clearTokens('get_me_failed');
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load check
  useEffect(() => {
    let isMounted = true;

    async function init() {
      if (tokenManager.hasTokens()) {
        try {
          const profile = await authApi.getMe();
          if (isMounted) {
            setUser(profile);
          }
        } catch {
          tokenManager.clearTokens('init_failed');
          if (isMounted) {
            setUser(null);
          }
        } finally {
          if (isMounted) {
            setIsLoading(false);
          }
        }
      }
    }

    void init();

    return () => {
      isMounted = false;
    };
  }, []);

  // Login handler
  const login = useCallback(
    async (credentials: LoginCredentials) => {
      setIsLoading(true);
      try {
        const data = await authApi.login(credentials);
        tokenManager.setTokens(data.accessToken, data.refreshToken);
        setUser(data.user);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Logout handler
  const logout = useCallback(async () => {
    setIsLoading(true);
    const currentRefreshToken = tokenManager.getRefreshToken();
    try {
      if (currentRefreshToken) {
        await authApi.logout(currentRefreshToken);
      }
    } catch (err) {
      // Even if network or server logout fails, clear local credentials
      console.warn('Backend logout encountered error, clearing in-memory session:', err);
    } finally {
      tokenManager.clearTokens('user_logout');
      setUser(null);
      setIsLoading(false);
    }
  }, []);

  // Explicit session refresh handler
  const refreshSession = useCallback(async () => {
    const currentRefreshToken = tokenManager.getRefreshToken();
    if (!currentRefreshToken) {
      throw new Error('No refresh token available');
    }

    const data = await tokenManager.executeRefresh(async (token) => {
      return authApi.refresh(token);
    });

    setAccessToken(data);
  }, []);

  const value: AuthContextType = {
    user,
    accessToken,
    refreshToken,
    isAuthenticated: Boolean(user && accessToken),
    isLoading,
    login,
    logout,
    refreshSession,
    loadCurrentUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
