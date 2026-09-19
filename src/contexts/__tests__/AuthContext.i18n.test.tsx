import { ThemeProvider, createTheme } from '@mui/material/styles';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import '@testing-library/jest-dom';
import LoginForm from '@/components/auth/LoginForm';
import { renderWithLocale } from '@/i18n/testing';
import { AuthProvider, useAuth } from '../AuthContext';

/**
 * AuthContext throws the text that LoginForm, RegisterForm and the profile screens render
 * straight into an Alert, so those throws are auth's copy even though they happen in a
 * context. Auth.i18n.test.tsx cannot cover them - it replaces this module with a mock so it
 * can drive the forms - so the real provider is exercised here, with fetch answering the way
 * a route that has no `code` yet does.
 */

const theme = createTheme();

const renderInSpanish = (ui: React.ReactElement) =>
  renderWithLocale(
    (element) => render(<ThemeProvider theme={theme}>{element}</ThemeProvider>),
    'es',
    ui
  );

/** Calls updateProfile with nobody logged in and shows whatever it throws. */
function ProfileUpdateProbe() {
  const { updateProfile } = useAuth();
  const [message, setMessage] = React.useState('');

  return (
    <button
      onClick={() =>
        updateProfile({ fullName: 'Nombre nuevo' }).catch((err: unknown) =>
          setMessage(err instanceof Error ? err.message : String(err))
        )
      }
    >
      {message || 'Actualizar'}
    </button>
  );
}

describe('AuthContext in Spanish', () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    // resetAllMocks also empties the mockResolvedValueOnce queue, so a response left
    // over from a previous test cannot answer this one's mount check
    jest.resetAllMocks();
    global.fetch = jest.fn();
    mockFetch = global.fetch as jest.Mock;
  });

  /** The /api/auth/me call every mount makes: nobody is logged in. */
  const mockAnonymousMount = () => mockFetch.mockResolvedValueOnce({ ok: false });

  const submitLogin = () => {
    fireEvent.change(screen.getByPlaceholderText('Email o usuario'), {
      target: { value: 'chef' },
    });
    fireEvent.change(screen.getByPlaceholderText('Contraseña'), {
      target: { value: 'Password1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
  };

  it('should fall back to the Spanish message when the login route sends no code and no error', async () => {
    mockAnonymousMount();
    mockFetch.mockResolvedValueOnce({ ok: false, json: async () => ({}) });

    renderInSpanish(
      <AuthProvider>
        <LoginForm onSwitchToRegister={jest.fn()} />
      </AuthProvider>
    );

    submitLogin();

    expect(await screen.findByText('No pudimos iniciar sesión')).toBeInTheDocument();
  });

  it("should keep showing the server's own sentence while the route carries no code", async () => {
    mockAnonymousMount();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Invalid credentials' }),
    });

    renderInSpanish(
      <AuthProvider>
        <LoginForm onSwitchToRegister={jest.fn()} />
      </AuthProvider>
    );

    submitLogin();

    // English on purpose: that fallback is what makes the migration additive, and it
    // disappears the moment owner F attaches a code to /api/auth/login
    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
  });

  it('should say in Spanish that there is no session when updateProfile runs logged out', async () => {
    mockAnonymousMount();

    renderInSpanish(
      <AuthProvider>
        <ProfileUpdateProbe />
      </AuthProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));

    expect(await screen.findByText('No hay una sesión iniciada')).toBeInTheDocument();
    // It never reached the network: only the mount check was made
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
