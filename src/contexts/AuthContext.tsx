'use client';
// NOTE: All fetch() calls in this file use `credentials: 'same-origin'` explicitly.
// This is the browser default for same-origin requests, but we include it for clarity
// since auth depends on httpOnly cookies being sent. Other fetch calls in the app
// (RecipeFeed, notifications, etc.) rely on the browser default and do not need it.
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import { getQueryClient } from '@/providers/QueryProvider';

export type User = {
  id: string;
  email: string;
  username: string;
  fullName?: string | null;
  bio?: string | null;
  avatar?: string | null;
  website?: string | null;
  role: 'USER' | 'ADMIN';
  isVerified: boolean;
  isPrivate: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type AuthContextType = {
  user: User | null;
  /** @deprecated Auth is cookie-based. Use `isAuthenticated` instead. */
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (emailOrUsername: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string, fullName?: string) => Promise<void>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Ref mirrors user state so memoized callbacks can read latest value
  const userRef = React.useRef(user);
  userRef.current = user;

  // Check auth status on mount via httpOnly cookie (sent automatically)
  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'same-origin',
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.data);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Failed to fetch current user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = useCallback(async (emailOrUsername: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
      credentials: 'same-origin',
      body: JSON.stringify({ emailOrUsername, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }

    const data = await response.json();
    setUser(data.data.user);
  }, []);

  const register = useCallback(
    async (email: string, username: string, password: string, fullName?: string) => {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
        credentials: 'same-origin',
        body: JSON.stringify({ email, username, password, fullName }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Registration failed');
      }

      const data = await response.json();
      setUser(data.data.user);
    },
    []
  );

  // Optimistic logout: UI clears immediately, cookie may persist on network failure.
  const logout = useCallback(async () => {
    setUser(null);
    try {
      getQueryClient()?.clear();
    } catch {
      // On the server, getQueryClient() creates a new empty client so clear() is a no-op.
      // In tests without QueryClientProvider, getQueryClient() may throw.
    }

    const sendLogoutRequest = async () => {
      const resp = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
        credentials: 'same-origin',
      });
      return resp.ok;
    };

    const retryLogout = () => {
      setTimeout(async () => {
        try {
          const ok = await sendLogoutRequest();
          if (!ok) {
            console.warn('Failed to clear auth cookie server-side (retry)');
            window.dispatchEvent(new CustomEvent('auth:logout-failed'));
          }
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') return;
          console.warn('Failed to clear auth cookie server-side (retry, network error)');
          window.dispatchEvent(new CustomEvent('auth:logout-failed'));
        }
      }, 1000);
    };

    // Clear httpOnly cookie server-side. Fire a background retry on failure.
    try {
      const ok = await sendLogoutRequest();
      if (!ok) retryLogout();
    } catch {
      retryLogout();
    }
  }, []);

  const updateProfile = useCallback(async (data: Partial<User>) => {
    if (!userRef.current) {
      throw new Error('Not authenticated');
    }

    const response = await fetch('/api/users/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
      credentials: 'same-origin',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Update failed');
    }

    const result = await response.json();
    setUser(result.data);
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      token: null,
      isLoading,
      isAuthenticated: !!user,
      isAdmin: user?.role === 'ADMIN',
      login,
      register,
      logout,
      updateProfile,
    }),
    [user, isLoading, login, register, logout, updateProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
