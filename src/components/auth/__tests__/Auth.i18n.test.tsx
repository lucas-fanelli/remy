import { ThemeProvider, createTheme } from '@mui/material/styles';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import '@testing-library/jest-dom';
import AuthPage from '@/app/auth/page';
import { renderWithLocale } from '@/i18n/testing';
import ForgotPasswordForm from '../ForgotPasswordForm';
import LoginForm from '../LoginForm';
import RegisterForm from '../RegisterForm';
import ResetPasswordForm from '../ResetPasswordForm';

/**
 * The counterpart of the suites next to this one: those assert the ENGLISH copy and were not
 * touched by the migration, this one proves the very same screens render Spanish when the
 * locale says so - including the two indirect paths, the password rules (a pure list that
 * hands back descriptors) and the auth context's error fallbacks.
 */

const mockUseAuth = jest.fn();
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('@/contexts/CreateRecipeContext', () => ({
  CREATE_INTENT: 'create',
  useCreateRecipeDialog: () => ({ openCreate: jest.fn() }),
}));

const theme = createTheme();

const renderInSpanish = (ui: React.ReactElement) =>
  renderWithLocale(
    (element) => render(<ThemeProvider theme={theme}>{element}</ThemeProvider>),
    'es',
    ui
  );

describe('Auth screens in Spanish', () => {
  let mockLogin: jest.Mock;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLogin = jest.fn();
    mockUseAuth.mockReturnValue({
      login: mockLogin,
      register: jest.fn(),
      isAuthenticated: false,
      isLoading: false,
    });
    mockFetch = global.fetch as jest.Mock;
    mockFetch.mockReset();
  });

  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  describe('LoginForm', () => {
    it('should label its fields and its button in Spanish', () => {
      renderInSpanish(<LoginForm onSwitchToRegister={jest.fn()} />);

      expect(screen.getByPlaceholderText('Email o usuario')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Contraseña')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: '¿Olvidaste tu contraseña?' })).toBeInTheDocument();
      expect(screen.getByText('¿No tenés cuenta?')).toBeInTheDocument();
      expect(screen.getByText('Crear cuenta')).toBeInTheDocument();
    });

    it('should confirm a finished password reset in Spanish', () => {
      window.history.replaceState({}, '', '/auth?reset=success');

      renderInSpanish(<LoginForm onSwitchToRegister={jest.fn()} />);

      expect(screen.getByRole('status')).toHaveTextContent(
        'Actualizamos tu contraseña. Iniciá sesión con la nueva.'
      );
    });

    it('should fall back to the Spanish message when login fails without one', async () => {
      mockLogin.mockRejectedValueOnce('not an Error');
      renderInSpanish(<LoginForm onSwitchToRegister={jest.fn()} />);

      fireEvent.change(screen.getByPlaceholderText('Email o usuario'), {
        target: { value: 'chef' },
      });
      fireEvent.change(screen.getByPlaceholderText('Contraseña'), {
        target: { value: 'Password1' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

      expect(await screen.findByText('No pudimos iniciar sesión')).toBeInTheDocument();
    });
  });

  describe('RegisterForm', () => {
    it('should render every field, the helper text and the terms in Spanish', () => {
      renderInSpanish(<RegisterForm onSwitchToLogin={jest.fn()} />);

      expect(screen.getByPlaceholderText('Tu email')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Nombre completo')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Usuario')).toBeInTheDocument();
      expect(
        screen.getByText('La contraseña tiene que tener mayúscula, minúscula y número')
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          'Al crear tu cuenta, aceptás nuestros Términos, la Política de datos y la Política de cookies.'
        )
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeInTheDocument();
      expect(screen.getByText('¿Ya tenés cuenta?')).toBeInTheDocument();
    });
  });

  describe('AuthPage', () => {
    it('should offer the guest link inside one Spanish sentence', () => {
      renderInSpanish(<AuthPage />);

      const guestLink = screen.getByRole('link', { name: 'Seguí como invitado' });
      expect(guestLink).toHaveAttribute('href', '/');
      expect(guestLink.closest('p')).toHaveTextContent('¿Solo mirando? Seguí como invitado');
    });
  });

  describe('ForgotPasswordForm', () => {
    it('should render its heading, its field and its button in Spanish', () => {
      renderInSpanish(<ForgotPasswordForm />);

      expect(
        screen.getByRole('heading', { name: '¿Olvidaste tu contraseña?' })
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/Email o usuario/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Enviar link' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Volver a iniciar sesión' })).toBeInTheDocument();
    });

    it('should ask for the identifier in Spanish and not call the API', () => {
      renderInSpanish(<ForgotPasswordForm />);

      fireEvent.click(screen.getByRole('button', { name: 'Enviar link' }));

      expect(screen.getByText('Ingresá tu email o usuario')).toBeInTheDocument();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should explain a connection failure in Spanish', async () => {
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));
      renderInSpanish(<ForgotPasswordForm />);

      fireEvent.change(screen.getByLabelText(/Email o usuario/), { target: { value: 'chef' } });
      fireEvent.click(screen.getByRole('button', { name: 'Enviar link' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'No pudimos conectarnos. Revisá tu conexión y probá de nuevo.'
      );
    });
  });

  describe('ResetPasswordForm', () => {
    const TOKEN = 'raw-token-from-the-email';

    it('should render the form and the password checklist in Spanish', () => {
      renderInSpanish(<ResetPasswordForm token={TOKEN} />);

      expect(
        screen.getByRole('heading', { name: 'Elegí una contraseña nueva' })
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/^Contraseña nueva/)).toBeInTheDocument();
      expect(screen.getByLabelText(/^Confirmá la contraseña nueva/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Guardar contraseña nueva' })).toBeInTheDocument();

      // The checklist comes from PASSWORD_RULES, which returns descriptors and not sentences
      const rules = screen.getByRole('list', { name: 'Requisitos de la contraseña' });
      expect(rules).toHaveTextContent('Al menos 8 caracteres');
      expect(rules).toHaveTextContent('Una mayúscula');
      expect(rules).toHaveTextContent('Una minúscula');
      expect(rules).toHaveTextContent('Un número');
    });

    it('should render a broken password rule in Spanish under the field', () => {
      renderInSpanish(<ResetPasswordForm token={TOKEN} />);

      fireEvent.change(screen.getByLabelText(/^Contraseña nueva/), { target: { value: 'Ab1' } });
      fireEvent.change(screen.getByLabelText(/^Confirmá la contraseña nueva/), {
        target: { value: 'Ab1' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña nueva' }));

      expect(
        screen.getByText('La contraseña tiene que tener al menos 8 caracteres')
      ).toBeInTheDocument();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should mark a satisfied rule in Spanish for assistive technology', () => {
      renderInSpanish(<ResetPasswordForm token={TOKEN} />);

      fireEvent.change(screen.getByLabelText(/^Contraseña nueva/), { target: { value: 'abc' } });

      const items = screen.getAllByRole('listitem');
      expect(items.find((li) => /minúscula/.test(li.textContent ?? ''))).toHaveTextContent(
        '(cumplido)'
      );
      expect(items.find((li) => /mayúscula/.test(li.textContent ?? ''))).toHaveTextContent(
        '(todavía no)'
      );
    });

    it('should explain an invalid link in Spanish', () => {
      renderInSpanish(<ResetPasswordForm token={null} />);

      expect(screen.getByRole('heading', { name: 'Link no válido' })).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Este link no es válido o ya venció. Los links de recuperación sirven una sola vez y vencen a los 60 minutos.'
      );
      expect(screen.getByRole('link', { name: 'Pedir un link nuevo' })).toBeInTheDocument();
    });
  });
});
