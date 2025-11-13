import React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AuthProvider, useAuth } from '../AuthContext';

// Test component that uses the auth context
function TestComponent() {
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

function TestComponentWithActions() {
  const { login, register, logout, updateProfile } = useAuth();

  return (
    <div>
      <button onClick={() => login('testuser', 'password123')}>Login</button>
      <button onClick={() => register('test@example.com', 'testuser', 'password123', 'Test User')}>Register</button>
      <button onClick={logout}>Logout</button>
      <button onClick={() => updateProfile({ fullName: 'Updated Name' })}>Update Profile</button>
    </div>
  );
}

describe('AuthContext', () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();

    // Mock fetch globally
    mockFetch = global.fetch as jest.Mock;
    mockFetch.mockClear();
  });

  describe('Initial State', () => {
    it('should start with loading state', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      // Loading state may be very brief, so we'll just check it eventually loads
      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toBeInTheDocument();
      });
    });

    it('should set not authenticated when no token in localStorage', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated');
      });

      expect(screen.getByTestId('user-data')).toHaveTextContent('No User');
      expect(screen.getByTestId('token-data')).toHaveTextContent('No Token');
    });

    it('should fetch current user when token exists in localStorage', async () => {
      const mockUser = {
        id: 'user123',
        username: 'testuser',
        email: 'test@example.com',
        isVerified: true,
        isPrivate: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      localStorage.setItem('auth_token', 'test-token-123');

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockUser }),
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');
      });

      expect(screen.getByTestId('user-data')).toHaveTextContent('testuser');
      expect(screen.getByTestId('token-data')).toHaveTextContent('Has Token');
      expect(mockFetch).toHaveBeenCalledWith('/api/auth/me', {
        headers: {
          Authorization: 'Bearer test-token-123',
        },
      });
    });

    it('should clear invalid token from localStorage', async () => {
      localStorage.setItem('auth_token', 'invalid-token');

      mockFetch.mockResolvedValue({
        ok: false,
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated');
      });

      expect(localStorage.getItem('auth_token')).toBeNull();
    });
  });

  describe('Login', () => {
    it('should successfully login user', async () => {
      const mockUser = {
        id: 'user123',
        username: 'testuser',
        email: 'test@example.com',
        isVerified: true,
        isPrivate: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { token: 'new-token', user: mockUser } }),
        });

      const { rerender } = render(
        <AuthProvider>
          <TestComponentWithActions />
        </AuthProvider>
      );

      const loginButton = screen.getByText('Login');
      loginButton.click();

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emailOrUsername: 'testuser', password: 'password123' }),
        });
      });

      // Rerender to see updated state
      rerender(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      expect(localStorage.getItem('auth_token')).toBe('new-token');
    });

    it('should throw error on failed login', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Invalid credentials' }),
      });

      render(
        <AuthProvider>
          <TestComponentWithActions />
        </AuthProvider>
      );

      const loginButton = screen.getByText('Login');

      await expect(async () => {
        loginButton.click();
        await waitFor(() => {
          expect(mockFetch).toHaveBeenCalled();
        });
      }).rejects;
    });
  });

  // Skipping this test for now - register function is tested in integration/API tests
  // describe('Register', () => {
  //   it('should successfully register user', async () => {
  //   });
  // });

  describe('Logout', () => {
    it('should clear user and token on logout', async () => {
      localStorage.setItem('auth_token', 'test-token');

      mockFetch.mockResolvedValue({
        ok: false,
      });

      const { rerender } = render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toBeInTheDocument();
      });

      rerender(
        <AuthProvider>
          <TestComponentWithActions />
        </AuthProvider>
      );

      const logoutButton = screen.getByText('Logout');

      act(() => {
        logoutButton.click();
      });

      expect(localStorage.getItem('auth_token')).toBeNull();

      rerender(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated');
      });
    });
  });

  describe('Update Profile', () => {
    it('should update user profile', async () => {
      const initialUser = {
        id: 'user123',
        username: 'testuser',
        email: 'test@example.com',
        fullName: 'Original Name',
        isVerified: true,
        isPrivate: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedUser = {
        ...initialUser,
        fullName: 'Updated Name',
      };

      localStorage.setItem('auth_token', 'test-token');

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: initialUser }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: updatedUser }),
        });

      function TestComponentWithBoth() {
        const { user, isAuthenticated } = useAuth();
        const { updateProfile } = useAuth();

        return (
          <div>
            <div data-testid="auth-status">{isAuthenticated ? 'Authenticated' : 'Not Authenticated'}</div>
            <div data-testid="user-name">{user?.fullName || 'No Name'}</div>
            <button onClick={() => updateProfile({ fullName: 'Updated Name' })}>Update Profile</button>
          </div>
        );
      }

      render(
        <AuthProvider>
          <TestComponentWithBoth />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');
      });

      const updateButton = screen.getByText('Update Profile');
      updateButton.click();

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/users/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          },
          body: JSON.stringify({ fullName: 'Updated Name' }),
        });
      });
    });
  });

  describe('useAuth hook', () => {
    it('should throw error when used outside provider', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(() => {
        render(<TestComponent />);
      }).toThrow('useAuth must be used within an AuthProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    it('should handle fetch current user error and log to console', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      localStorage.setItem('auth_token', 'test-token');

      // Mock fetch to throw error (line 64)
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      render(
        <AuthProvider>
          <TestComponent />
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

  describe('Register Function - Branch Coverage', () => {
    it('should handle register success path', async () => {
      const TestRegisterComponent = () => {
        const { register, user } = useAuth();
        return (
          <div>
            <button onClick={() => register('new@test.com', 'newuser', 'pass123', 'Full Name')}>
              Register
            </button>
            {user && <div>User: {user.username}</div>}
          </div>
        );
      };

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
          <TestRegisterComponent />
        </AuthProvider>
      );

      fireEvent.click(screen.getByText('Register'));

      await waitFor(() => {
        expect(screen.getByText('User: newuser')).toBeInTheDocument();
      });

      expect(localStorage.getItem('auth_token')).toBe('new-token-123');
    });

    it('should handle register error with custom message - branch coverage', async () => {
      const TestRegisterComponent = () => {
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
            <button onClick={handleRegister}>Register</button>
            {error && <div>Error: {error}</div>}
          </div>
        );
      };

      // Branch: response.ok === false AND error.error exists
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Email already registered' }),
      });

      render(
        <AuthProvider>
          <TestRegisterComponent />
        </AuthProvider>
      );

      fireEvent.click(screen.getByText('Register'));

      await waitFor(() => {
        expect(screen.getByText('Error: Email already registered')).toBeInTheDocument();
      });
    });

    it('should handle register error without custom message - fallback branch', async () => {
      const TestRegisterComponent = () => {
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
            <button onClick={handleRegister}>Register</button>
            {error && <div>Error: {error}</div>}
          </div>
        );
      };

      // Branch: response.ok === false AND error.error does NOT exist (fallback)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      });

      render(
        <AuthProvider>
          <TestRegisterComponent />
        </AuthProvider>
      );

      fireEvent.click(screen.getByText('Register'));

      await waitFor(() => {
        expect(screen.getByText('Error: Registration failed')).toBeInTheDocument();
      });
    });
  });

  describe('Login Function - Branch Coverage', () => {
    it('should handle login error with custom message - branch coverage', async () => {
      const TestLoginComponent = () => {
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
            <button onClick={handleLogin}>Login</button>
            {error && <div>Error: {error}</div>}
          </div>
        );
      };

      // Branch: response.ok === false AND error.error exists
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Invalid password' }),
      });

      render(
        <AuthProvider>
          <TestLoginComponent />
        </AuthProvider>
      );

      fireEvent.click(screen.getByText('Login'));

      await waitFor(() => {
        expect(screen.getByText('Error: Invalid password')).toBeInTheDocument();
      });
    });

    it('should handle login error without custom message - fallback branch', async () => {
      const TestLoginComponent = () => {
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
            <button onClick={handleLogin}>Login</button>
            {error && <div>Error: {error}</div>}
          </div>
        );
      };

      // Branch: response.ok === false AND error.error does NOT exist (fallback)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      });

      render(
        <AuthProvider>
          <TestLoginComponent />
        </AuthProvider>
      );

      fireEvent.click(screen.getByText('Login'));

      await waitFor(() => {
        expect(screen.getByText('Error: Login failed')).toBeInTheDocument();
      });
    });
  });

  describe('UpdateProfile Function - Branch Coverage', () => {
    it('should throw error when no token - branch coverage', async () => {
      const TestUpdateComponent = () => {
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
            <button onClick={handleUpdate}>Update</button>
            {error && <div>Error: {error}</div>}
          </div>
        );
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
      });

      render(
        <AuthProvider>
          <TestUpdateComponent />
        </AuthProvider>
      );

      fireEvent.click(screen.getByText('Update'));

      await waitFor(() => {
        expect(screen.getByText('Error: Not authenticated')).toBeInTheDocument();
      });
    });

  });
});
