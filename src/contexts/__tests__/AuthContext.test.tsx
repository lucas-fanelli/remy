import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import '@testing-library/jest-dom';
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

  /** Sets up the mount fetch to return unauthenticated. */
  function mockUnauthenticatedMount() {
    mockFetch.mockResolvedValueOnce({ ok: false });
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

    it('should clear user when cookie auth returns not ok', async () => {
      mockUnauthenticatedMount();

      render(
        <AuthProvider>
          <AuthStatus />
        </AuthProvider>
      );

      await waitForUnauthenticated();
      expect(screen.getByTestId('token-data')).toHaveTextContent('No Token');
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
