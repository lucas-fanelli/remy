'use client';
// NOTE: All fetch() calls in this file use `credentials: 'same-origin'` explicitly.
// This is the browser default for same-origin requests, but we include it for clarity
// since auth depends on httpOnly cookies being sent. Other fetch calls in the app
// (RecipeFeed, notifications, etc.) rely on the browser default and do not need it.
import { useTranslations } from 'next-intl';
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import { useApiErrorMessage } from '@/lib/api/translateApiError';
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

// Only a 401 from /api/auth/me means "not logged in". A network error, a 5xx or a 429
// from the rate limiter says nothing about the session, so the check is repeated after
// these delays instead of dropping the user to the logged-out UI.
const SESSION_RETRY_DELAYS_MS = [1000, 2000, 5000, 15000, 30000];
// The first retries hold isLoading so a blip never flashes the logged-out UI; the rest
// run in the background and bring the user back once the server answers.
const BLOCKING_SESSION_RETRIES = 2;
// A resumed PWA or a long-lived tab never remounts: ask again when it becomes visible
// after this long, so the server's sliding session renewal reaches it too.
const SESSION_RECHECK_AFTER_MS = 60 * 60 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const t = useTranslations('auth');
  // These throws are rendered straight into LoginForm / RegisterForm, so they are that
  // screen's text: the server's own sentence when it sent one, ours when it did not.
  const apiErrorMessage = useApiErrorMessage();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Ref mirrors user state so memoized callbacks can read latest value
  const userRef = React.useRef(user);
  userRef.current = user;
  // `epoch` is bumped by login, register and logout: they know the session first-hand,
  // so a check that started before them is stale and must not overwrite their result
  const sessionCheckRef = React.useRef({
    epoch: 0,
    inProgress: false,
    answeredAt: 0,
    retryTimer: null as ReturnType<typeof setTimeout> | null,
  });

  // Check auth status on mount via httpOnly cookie (sent automatically)
  useEffect(() => {
    const check = sessionCheckRef.current;

    const fetchCurrentUser = async (attempt = 0) => {
      const epoch = check.epoch;
      check.inProgress = true;

      let session: User | null | undefined; // undefined: the server could not say
      try {
        const response = await fetch('/api/auth/me', {
          credentials: 'same-origin',
        });

        if (response.ok) {
          const data = await response.json();
          session = data.data;
        } else if (response.status === 401) {
          session = null;
        }
      } catch (error) {
        console.error('Failed to fetch current user:', error);
      }

      if (epoch !== check.epoch) return;

      if (session !== undefined) {
        check.inProgress = false;
        check.answeredAt = Date.now();
        setUser(session);
        setIsLoading(false);
        return;
      }

      // No answer is not a logout: keep the current user and ask again later
      if (attempt < SESSION_RETRY_DELAYS_MS.length) {
        check.retryTimer = setTimeout(
          () => fetchCurrentUser(attempt + 1),
          SESSION_RETRY_DELAYS_MS[attempt]
        );
      } else {
        check.inProgress = false;
      }
      if (attempt >= BLOCKING_SESSION_RETRIES) {
        setIsLoading(false);
      }
    };

    const recheckWhenVisible = () => {
      const isDue = Date.now() - check.answeredAt >= SESSION_RECHECK_AFTER_MS;
      if (document.visibilityState === 'visible' && !check.inProgress && isDue) {
        fetchCurrentUser();
      }
    };

    fetchCurrentUser();
    document.addEventListener('visibilitychange', recheckWhenVisible);

    return () => {
      document.removeEventListener('visibilitychange', recheckWhenVisible);
      // Unmounted: a check still in flight or waiting to retry no longer counts
      check.epoch++;
      if (check.retryTimer) clearTimeout(check.retryTimer);
    };
  }, []);

  /** login, register and logout settle the session themselves: drop any pending check */
  const settleSession = useCallback((nextUser: User | null) => {
    const check = sessionCheckRef.current;
    check.epoch++;
    check.inProgress = false;
    check.answeredAt = Date.now();
    if (check.retryTimer) clearTimeout(check.retryTimer);
    setUser(nextUser);
    setIsLoading(false);
  }, []);

  const login = useCallback(
    async (emailOrUsername: string, password: string) => {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
        credentials: 'same-origin',
        body: JSON.stringify({ emailOrUsername, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(apiErrorMessage(error, t('errors.loginFailed')));
      }

      const data = await response.json();
      settleSession(data.data.user);
    },
    [apiErrorMessage, settleSession, t]
  );

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
        throw new Error(apiErrorMessage(error, t('errors.registrationFailed')));
      }

      const data = await response.json();
      settleSession(data.data.user);
    },
    [apiErrorMessage, settleSession, t]
  );

  // Optimistic logout: UI clears immediately, cookie may persist on network failure.
  const logout = useCallback(async () => {
    settleSession(null);
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
  }, [settleSession]);

  const updateProfile = useCallback(
    async (data: Partial<User>) => {
      if (!userRef.current) {
        throw new Error(t('errors.notAuthenticated'));
      }

      const response = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
        credentials: 'same-origin',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(apiErrorMessage(error, t('errors.updateFailed')));
      }

      const result = await response.json();
      setUser(result.data);
    },
    [apiErrorMessage, t]
  );

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
