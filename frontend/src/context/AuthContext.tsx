import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { fetchCurrentUser, loginUser, logoutUser, registerUser } from '../services/authService';
import type { RegisterPayload, User } from '../types';
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from '../lib/tokens';
import { STANDALONE } from '../lib/standalone';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  loginWithTokens: (accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_PLAYER: User = {
  id: 1,
  email: 'player@device.local',
  full_name: 'Player',
  is_active: true,
  is_verified: true,
  oauth_provider: null,
  created_at: '2026-01-01T00:00:00.000Z',
};

const unsupported = async (): Promise<void> => {
  throw new Error('Accounts are not used in the standalone app');
};

const LOCAL_AUTH: AuthContextType = {
  user: LOCAL_PLAYER,
  isLoading: false,
  login: unsupported,
  register: unsupported,
  loginWithTokens: unsupported,
  logout: async () => undefined,
};

function LocalAuthProvider({ children }: { children: ReactNode }) {
  return <AuthContext.Provider value={LOCAL_AUTH}>{children}</AuthContext.Provider>;
}

function RemoteAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!getAccessToken()) {
      setIsLoading(false);
      return;
    }
    fetchCurrentUser()
      .then(setUser)
      .catch(() => clearTokens())
      .finally(() => setIsLoading(false));
  }, []);

  const loginWithTokens = useCallback(async (accessToken: string, refreshToken: string) => {
    setTokens(accessToken, refreshToken);
    try {
      setUser(await fetchCurrentUser());
    } catch (err) {
      clearTokens();
      throw err;
    }
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await loginUser(email, password);
      await loginWithTokens(data.access_token, data.refresh_token);
    },
    [loginWithTokens],
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      await registerUser(payload);
      await login(payload.email, payload.password);
    },
    [login],
  );

  const logout = useCallback(async () => {
    const refresh = getRefreshToken();
    clearTokens();
    setUser(null);
    if (refresh) {
      try {
        await logoutUser(refresh);
      } catch {
        // Server-side revoke is best effort; the local session is already cleared.
      }
    }
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, login, register, loginWithTokens, logout }),
    [user, isLoading, login, register, loginWithTokens, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const AuthProvider = STANDALONE ? LocalAuthProvider : RemoteAuthProvider;

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
