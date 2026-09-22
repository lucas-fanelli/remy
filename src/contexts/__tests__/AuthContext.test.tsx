import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import '@testing-library/jest-dom';
import { queryKeys } from '@/lib/query/keys';
import { getQueryClient } from '@/providers/QueryProvider';
import { AuthProvider, useAuth } from '../AuthContext';

// Reusable test components
function AuthStatus() {
  const { user, isLoading, isAuthenticated, token } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <div data-testid="auth-status">{isAuthenticated ? 'Authenticated' : 'Not Authenticated'}</div>
      <div data-testid="user-data">{user ? user.username : 'No User'}</div>
      <div data-testid="token-data">{token ? 'Has Token' : 'No Token'}</div>
    </div>
  );
}

function AuthActions() {
  const { login, register, logout, updateProfile } = useAuth();

  return (
    <div>
      <button onClick={() => login('testuser', 'password123')}>Login</button>
      <button onClick={() => register('test@example.com', 'testuser', 'password123', 'Test User')}>
        Register
      </button>
      <button onClick={logout}>Logout</button>
      <button onClick={() => updateProfile({ fullName: 'Updated Name' })}>Update Profile</button>
    </div>
  );
}

describe('AuthContext', () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    // resetAllMocks clears call history AND the mockResolvedValueOnce queue,
    // preventing leftover mock responses from leaking between tests.
    jest.resetAllMocks();
    global.fetch = jest.fn();
    mockFetch = global.fetch as jest.Mock;
  });

  afterEach(() => {
    cleanup();
  });

  const mockUser = {
    id: 'user123',
    username: 'testuser',
    email: 'test@example.com',
    isVerified: true,
    isPrivate: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  /** Sets up the mount fetch to return an authenticated user. */
  function mockAuthenticatedMount() {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockUser }),
    });
  }

  /**
   * Sets up the mount fetch to return unauthenticated. Only a 401 means "no session":
   * any other failure is transient and must not log the user out.
   */
  function mockUnauthenticatedMount() {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
  }

  /** Waits for the initial auth check to complete and user to be authenticated. */
  async function waitForAuthenticated() {
    // Use exact regex: toHaveTextContent does substring matching by default,
    // so 'Authenticated' would also match 'Not Authenticated'.
    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent(/^Authenticated$/);
    });
  }

  /** Waits for the initial auth check to complete and user to be unauthenticated. */
  async function waitForUnauthenticated() {
    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent(/^Not Authenticated$/);
    });
  }

  /** Waits for the mount auth check to have been called. */
  async function waitForMountCheck() {
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/auth/me', { credentials: 'same-origin' });
    });
  }

  describe('sessionLikely', () => {
    // For keeping room for what only a signed-in reader sees, now that the home page does
    // not wait for /api/auth/me: the server's first impression while the check runs, then
    // the answer.
    function Likely() {
      const { sessionLikely, isLoading } = useAuth();
      return (
        <div data-testid="likely">{`${isLoading ? 'checking' : 'known'}:${sessionLikely}`}</div>
      );
    }

    it("is the layout's hint while the check runs, then the check's answer", async () => {
      let answer: (value: unknown) => void = () => {};
      mockFetch.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));

      render(
        <AuthProvider sessionHint>
          <Likely />
        </AuthProvider>
      );
      expect(screen.getByTestId('likely')).toHaveTextContent('checking:true');

      // The cookie was an expired session.
      answer({ ok: false, status: 401, json: async () => ({}) });

      await waitFor(() => expect(screen.getByTestId('likely')).toHaveTextContent('known:false'));
    });

    it('is false while the check runs when no session cookie came with the page', () => {
      mockFetch.mockReturnValueOnce(new Promise(() => {}));

      render(
        <AuthProvider>
          <Likely />
        </AuthProvider>
      );

      expect(screen.getByTestId('likely')).toHaveTextContent('checking:false');
    });
  });

  describe('Initial State', () => {
    it('should start with loading state', async () => {
      mockUnauthenticatedMount();

      render(
        <AuthProvider>
          <AuthStatus />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toBeInTheDocument();
      });
    });

    it('should set not authenticated when cookie auth fails', async () => {
      mockUnauthenticatedMount();

      render(
        <AuthProvider>
          <AuthStatus />
        </AuthProvider>
      );

      await waitForUnauthenticated();
      expect(screen.getByTestId('user-data')).toHaveTextContent('No User');
      expect(screen.getByTestId('token-data')).toHaveTextContent('No Token');
    });

    it('should fetch current user via cookie auth on mount', async () => {
      mockAuthenticatedMount();

      render(
        <AuthProvider>
          <AuthStatus />
        </AuthProvider>
      );

      await waitForAuthenticated();
      expect(screen.getByTestId('user-data')).toHaveTextContent('testuser');
      // After cookie-based auth, token stays null — auth is via httpOnly cookie
      expect(screen.getByTestId('token-data')).toHaveTextContent('No Token');
      expect(mockFetch).toHaveBeenCalledWith('/api/auth/me', { credentials: 'same-origin' });
    });

    it('should clear user when cookie auth returns 401', async () => {
      mockUnauthenticatedMount();

      render(
        <AuthProvider>
          <AuthStatus />
        </AuthProvider>
      );

      await waitForUnauthenticated();
      expect(screen.getByTestId('token-data')).toHaveTextContent('No Token');
    });

    // The session check failing is not a logout: the server did not say "no session",
    // it said nothing. Dropping the user here is what made the app feel like it logged
    // people out at random. The first retry waits a second, hence the fake timers.
    describe('when the session check fails', () => {
      beforeEach(() => {
        jest.useFakeTimers();
      });

      afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
      });

      /** Lets the pending fetch settle and the retry timer fire. */
      async function flushRetry() {
        await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
        await React.act(async () => {
          jest.advanceTimersByTime(1000);
        });
      }

      it.each([
        ['a network error', () => mockFetch.mockRejectedValueOnce(new Error('offline'))],
        ['a 500', () => mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })],
        [
          'a 429 from the rate limiter',
          () => mockFetch.mockResolvedValueOnce({ ok: false, status: 429 }),
        ],
      ])('should keep the session and retry after %s', async (_case, mockFailure) => {
        mockFailure();
        mockAuthenticatedMount(); // the retry succeeds

        render(
          <AuthProvider>
            <AuthStatus />
          </AuthProvider>
        );
        await flushRetry();

        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(screen.getByTestId('auth-status')).toHaveTextContent(/^Authenticated$/);
        expect(screen.getByTestId('user-data')).toHaveTextContent('testuser');
      });

      it('should never show the logged-out UI while the check keeps failing', async () => {
        mockFetch.mockRejectedValue(new Error('offline'));

        render(
          <AuthProvider>
            <AuthStatus />
          </AuthProvider>
        );
        await flushRetry();

        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(screen.queryByTestId('auth-status')).not.toBeInTheDocument(); // still loading
      });
    });
  });

  describe('Login', () => {
    it('should successfully login user', async () => {
      mockUnauthenticatedMount();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { token: 'new-token', user: mockUser } }),
      });

      const { rerender } = render(
        <AuthProvider>
          <AuthActions />
        </AuthProvider>
      );

      await waitForMountCheck();

      fireEvent.click(screen.getByText('Login'));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
          credentials: 'same-origin',
          body: JSON.stringify({ emailOrUsername: 'testuser', password: 'password123' }),
        });
      });

      rerender(
        <AuthProvider>
          <AuthStatus />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('token-data')).toHaveTextContent('No Token');
      });
    });

    it('should throw error on failed login with custom message', async () => {
      function LoginWithError() {
        const { login } = useAuth();
        const [error, setError] = React.useState('');

        const handleLogin = async () => {
          try {
            await login('test@test.com', 'wrongpass');
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Error');
          }
        };

        return (
          <div>
            <div data-testid="auth-status">Ready</div>
            <button onClick={handleLogin}>Login</button>
            {error && <div data-testid="error">{error}</div>}
          </div>
        );
      }

      mockUnauthenticatedMount();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Invalid password' }),
      });

      render(
        <AuthProvider>
          <LoginWithError />
        </AuthProvider>
      );

      await waitForMountCheck();
      fireEvent.click(screen.getByText('Login'));

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Invalid password');
      });
    });

    it('should use fallback message when login error has no custom message', async () => {
      function LoginWithError() {
        const { login } = useAuth();
        const [error, setError] = React.useState('');

        const handleLogin = async () => {
          try {
            await login('test@test.com', 'wrongpass');
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Error');
          }
        };

        return (
          <div>
            <div data-testid="auth-status">Ready</div>
            <button onClick={handleLogin}>Login</button>
            {error && <div data-testid="error">{error}</div>}
          </div>
        );
      }

      mockUnauthenticatedMount();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      });

      render(
        <AuthProvider>
          <LoginWithError />
        </AuthProvider>
      );

      await waitForMountCheck();
      fireEvent.click(screen.getByText('Login'));

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Login failed');
      });
    });
  });

  describe('Logout', () => {
    it('should clear user and token on logout', async () => {
      mockAuthenticatedMount();

      const { rerender } = render(
        <AuthProvider>
          <AuthStatus />
        </AuthProvider>
      );

      await waitForAuthenticated();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      rerender(
        <AuthProvider>
          <AuthActions />
        </AuthProvider>
      );

      fireEvent.click(screen.getByText('Logout'));

      rerender(
        <AuthProvider>
          <AuthStatus />
        </AuthProvider>
      );

      await waitForUnauthenticated();
      expect(mockFetch).toHaveBeenCalledWith('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
        credentials: 'same-origin',
      });
    });
  });

  describe('Register', () => {
    it('should handle register success', async () => {
      function RegisterComp() {
        const { register, user } = useAuth();
        return (
          <div>
            <div data-testid="auth-status">Ready</div>
            <button onClick={() => register('new@test.com', 'newuser', 'pass123', 'Full Name')}>
              Register
            </button>
            {user && <div data-testid="username">{user.username}</div>}
          </div>
        );
      }

      mockUnauthenticatedMount();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            user: { id: '1', username: 'newuser', email: 'new@test.com' },
            token: 'new-token-123',
          },
        }),
      });

      render(
        <AuthProvider>
          <RegisterComp />
        </AuthProvider>
      );

      await waitForMountCheck();
      fireEvent.click(screen.getByText('Register'));

      await waitFor(() => {
        expect(screen.getByTestId('username')).toHaveTextContent('newuser');
      });
    });

    it('should handle register error with custom message', async () => {
      function RegisterWithError() {
        const { register } = useAuth();
        const [error, setError] = React.useState('');

        const handleRegister = async () => {
          try {
            await register('test@test.com', 'testuser', 'pass123');
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Error');
          }
        };

        return (
          <div>
            <div data-testid="auth-status">Ready</div>
            <button onClick={handleRegister}>Register</button>
            {error && <div data-testid="error">{error}</div>}
          </div>
        );
      }

      mockUnauthenticatedMount();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Email already registered' }),
      });

      render(
        <AuthProvider>
          <RegisterWithError />
        </AuthProvider>
      );

      await waitForMountCheck();
      fireEvent.click(screen.getByText('Register'));

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Email already registered');
      });
    });

    it('should use fallback message when register error has no custom message', async () => {
      function RegisterWithError() {
        const { register } = useAuth();
        const [error, setError] = React.useState('');

        const handleRegister = async () => {
          try {
            await register('test@test.com', 'testuser', 'pass123');
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Error');
          }
        };

        return (
          <div>
            <div data-testid="auth-status">Ready</div>
            <button onClick={handleRegister}>Register</button>
            {error && <div data-testid="error">{error}</div>}
          </div>
        );
      }

      mockUnauthenticatedMount();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      });

      render(
        <AuthProvider>
          <RegisterWithError />
        </AuthProvider>
      );

      await waitForMountCheck();
      fireEvent.click(screen.getByText('Register'));

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Registration failed');
      });
    });
  });

  describe('Update Profile', () => {
    it('should update user profile', async () => {
      const updatedUser = { ...mockUser, fullName: 'Updated Name' };

      function ProfileComp() {
        const { isAuthenticated, updateProfile } = useAuth();
        const [error, setError] = React.useState('');
        const [updated, setUpdated] = React.useState(false);

        return (
          <div>
            <div data-testid="auth-status">
              {isAuthenticated ? 'Authenticated' : 'Not Authenticated'}
            </div>
            <button
              onClick={async () => {
                try {
                  await updateProfile({ fullName: 'Updated Name' });
                  setUpdated(true);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Update Profile
            </button>
            {updated && <div data-testid="updated">Updated</div>}
            {error && <div data-testid="error">{error}</div>}
          </div>
        );
      }

      mockFetch.mockImplementation((url: string | URL | Request) => {
        const urlString = typeof url === 'string' ? url : url.toString();
        if (urlString.includes('/api/auth/me')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: mockUser }),
          });
        }
        if (urlString.includes('/api/users/profile')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: updatedUser }),
          });
        }
        return Promise.resolve({ ok: false, json: async () => ({}) });
      });

      render(
        <AuthProvider>
          <ProfileComp />
        </AuthProvider>
      );

      await waitForAuthenticated();
      fireEvent.click(screen.getByText('Update Profile'));

      await waitFor(() => {
        expect(screen.getByTestId('updated')).toBeInTheDocument();
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/users/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
        credentials: 'same-origin',
        body: JSON.stringify({ fullName: 'Updated Name' }),
      });
    });

    it('should throw error when not authenticated', async () => {
      function UpdateWithError() {
        const { updateProfile } = useAuth();
        const [error, setError] = React.useState('');

        const handleUpdate = async () => {
          try {
            await updateProfile({ fullName: 'New Name' });
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Error');
          }
        };

        return (
          <div>
            <div data-testid="auth-status">Ready</div>
            <button onClick={handleUpdate}>Update</button>
            {error && <div data-testid="error">{error}</div>}
          </div>
        );
      }

      mockUnauthenticatedMount();

      render(
        <AuthProvider>
          <UpdateWithError />
        </AuthProvider>
      );

      await waitForMountCheck();
      fireEvent.click(screen.getByText('Update'));

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Not authenticated');
      });
    });

    it('should handle update profile error with custom message', async () => {
      function UpdateWithError() {
        const { updateProfile, isAuthenticated } = useAuth();
        const [error, setError] = React.useState('');

        const handleUpdate = async () => {
          try {
            await updateProfile({ fullName: 'New Name' });
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Error');
          }
        };

        return (
          <div>
            <div data-testid="auth-status">
              {isAuthenticated ? 'Authenticated' : 'Not Authenticated'}
            </div>
            <button onClick={handleUpdate}>Update</button>
            {error && <div data-testid="error">{error}</div>}
          </div>
        );
      }

      mockFetch.mockImplementation((url: string | URL | Request) => {
        const urlString = typeof url === 'string' ? url : url.toString();
        if (urlString.includes('/api/auth/me')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: mockUser }),
          });
        }
        if (urlString.includes('/api/users/profile')) {
          return Promise.resolve({
            ok: false,
            json: async () => ({ error: 'Profile update not allowed' }),
          });
        }
        return Promise.resolve({ ok: false, json: async () => ({}) });
      });

      render(
        <AuthProvider>
          <UpdateWithError />
        </AuthProvider>
      );

      await waitForAuthenticated();
      fireEvent.click(screen.getByText('Update'));

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Profile update not allowed');
      });
    });

    it('should use fallback message when update error has no custom message', async () => {
      function UpdateWithError() {
        const { updateProfile, isAuthenticated } = useAuth();
        const [error, setError] = React.useState('');

        const handleUpdate = async () => {
          try {
            await updateProfile({ fullName: 'New Name' });
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Error');
          }
        };

        return (
          <div>
            <div data-testid="auth-status">
              {isAuthenticated ? 'Authenticated' : 'Not Authenticated'}
            </div>
            <button onClick={handleUpdate}>Update</button>
            {error && <div data-testid="error">{error}</div>}
          </div>
        );
      }

      mockFetch.mockImplementation((url: string | URL | Request) => {
        const urlString = typeof url === 'string' ? url : url.toString();
        if (urlString.includes('/api/auth/me')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: mockUser }),
          });
        }
        if (urlString.includes('/api/users/profile')) {
          return Promise.resolve({
            ok: false,
            json: async () => ({}),
          });
        }
        return Promise.resolve({ ok: false, json: async () => ({}) });
      });

      render(
        <AuthProvider>
          <UpdateWithError />
        </AuthProvider>
      );

      await waitForAuthenticated();
      fireEvent.click(screen.getByText('Update'));

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Update failed');
      });
    });
  });

  // Feeds, profiles and recipes are fetched as whoever is signed in and cached under keys
  // that do not name them, so the cache is that person's. Only logout used to empty it: the
  // next account to sign in on the same tab was served the previous one's entries, private
  // recipes included, until they went stale.
  describe('Query cache', () => {
    const otherUser = { ...mockUser, id: 'user456', username: 'otheruser' };
    // A recipe of a private account that the first user may see and the next may not.
    const privateRecipe = { id: 'private-recipe', title: 'Guiso de la abuela' };
    const recipeKey = queryKeys.recipe(privateRecipe.id);

    const cache = () => getQueryClient();

    beforeEach(() => {
      cache().clear();
    });

    function renderSignedInApp() {
      render(
        <AuthProvider>
          <AuthStatus />
          <AuthActions />
        </AuthProvider>
      );
    }

    it('empties the cache when a different account signs in', async () => {
      mockAuthenticatedMount();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { user: otherUser } }),
      });

      renderSignedInApp();
      await waitForAuthenticated();
      cache().setQueryData(recipeKey, privateRecipe);

      fireEvent.click(screen.getByText('Login'));

      await waitFor(() => {
        expect(screen.getByTestId('user-data')).toHaveTextContent('otheruser');
      });
      expect(cache().getQueryData(recipeKey)).toBeUndefined();
    });

    it('empties the cache when the session check finds the session gone', async () => {
      // The tab comes back after an hour, the session has expired, and the recheck answers
      // 401. Whoever signs in next starts from nothing.
      mockAuthenticatedMount();
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

      renderSignedInApp();
      await waitForAuthenticated();
      cache().setQueryData(recipeKey, privateRecipe);

      const anHourLater = Date.now() + 60 * 60 * 1000;
      const now = jest.spyOn(Date, 'now').mockReturnValue(anHourLater);
      try {
        fireEvent(document, new Event('visibilitychange'));

        await waitForUnauthenticated();
        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(cache().getQueryData(recipeKey)).toBeUndefined();
      } finally {
        now.mockRestore();
      }
    });

    it('still empties the cache on logout', async () => {
      mockAuthenticatedMount();
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });

      renderSignedInApp();
      await waitForAuthenticated();
      cache().setQueryData(recipeKey, privateRecipe);

      fireEvent.click(screen.getByText('Logout'));

      await waitForUnauthenticated();
      expect(cache().getQueryData(recipeKey)).toBeUndefined();
    });

    it('keeps what the page fetched while the first session check was out', async () => {
      // Both went out with the same cookie, so the data is already the signed-in user's.
      // Emptying the cache here would only make the first screen load twice.
      cache().setQueryData(recipeKey, privateRecipe);
      mockAuthenticatedMount();

      renderSignedInApp();
      await waitForAuthenticated();

      expect(cache().getQueryData(recipeKey)).toEqual(privateRecipe);
    });
  });

  describe('useAuth hook', () => {
    it('should throw error when used outside provider', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(() => {
        render(<AuthStatus />);
      }).toThrow('useAuth must be used within an AuthProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    it('should handle fetch current user error and log to console', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      render(
        <AuthProvider>
          <AuthStatus />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to fetch current user:',
          expect.any(Error)
        );
      });

      consoleErrorSpy.mockRestore();
    });
  });
});
