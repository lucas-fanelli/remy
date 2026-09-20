import { ThemeProvider, createTheme } from '@mui/material/styles';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import '@testing-library/jest-dom';
import SettingsPage from '@/app/settings/page';
import { renderWithLocale } from '@/i18n/testing';
import ChangePasswordDialog from '../ChangePasswordDialog';

/**
 * The Spanish half of the settings area. The English assertions live in the suites next to
 * this file and were not touched; between them they cover both sides of every string here.
 */

const mockShowSuccess = jest.fn();
const mockShowError = jest.fn();
const mockToggleTheme = jest.fn();

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: '1', username: 'tester', email: 'tester@test.com' },
    isAuthenticated: true,
    isLoading: false,
  }),
}));

jest.mock('@/contexts/ToastContext', () => ({
  useToast: () => ({
    showToast: jest.fn(),
    showSuccess: mockShowSuccess,
    showError: mockShowError,
    showWarning: jest.fn(),
    showInfo: jest.fn(),
  }),
}));

jest.mock('@/contexts/PwaContext', () => ({
  usePwa: () => ({
    isInstalled: false,
    isRunningStandalone: false,
    isIOSSafari: false,
    isDesktopChrome: true,
    promptAvailable: false,
    triggerInstall: jest.fn(),
    openApp: jest.fn(),
  }),
}));

let mockThemeMode: 'light' | 'dark' = 'light';
jest.mock('@/contexts/ThemeContext', () => ({
  useThemeMode: () => ({ mode: mockThemeMode, toggleTheme: mockToggleTheme }),
}));

const theme = createTheme();

const renderInSpanish = (ui: React.ReactElement) =>
  renderWithLocale(
    (element) => render(<ThemeProvider theme={theme}>{element}</ThemeProvider>),
    'es',
    ui
  );

describe('Settings in Spanish', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockThemeMode = 'light';
  });

  describe('SettingsPage', () => {
    it('should render every section heading in Spanish', () => {
      renderInSpanish(<SettingsPage />);

      expect(screen.getByRole('heading', { name: 'Configuración' })).toBeInTheDocument();
      expect(
        screen.getByText('Administrá las preferencias y la configuración de tu cuenta')
      ).toBeInTheDocument();
      expect(screen.getByText('Apariencia')).toBeInTheDocument();
      expect(screen.getByText('Privacidad y seguridad')).toBeInTheDocument();
      expect(screen.getByText('Instalar la app')).toBeInTheDocument();
    });

    it('should describe the dark mode switch and the password entry in Spanish', () => {
      renderInSpanish(<SettingsPage />);

      expect(screen.getByRole('checkbox', { name: /modo oscuro/i })).toBeInTheDocument();
      expect(screen.getByText('Usá el tema oscuro en toda la app')).toBeInTheDocument();
      expect(screen.getByText('Cambiar contraseña')).toBeInTheDocument();
      expect(
        screen.getByText('Actualizá tu contraseña para mantener segura tu cuenta')
      ).toBeInTheDocument();
    });

    it('should confirm the theme change in Spanish, naming the mode it switched to', () => {
      renderInSpanish(<SettingsPage />);

      fireEvent.click(screen.getByRole('checkbox', { name: /modo oscuro/i }));

      expect(mockToggleTheme).toHaveBeenCalled();
      expect(mockShowSuccess).toHaveBeenCalledWith('Cambiaste al modo oscuro');
    });

    it('should keep the brand name out of the translated install copy', () => {
      renderInSpanish(<SettingsPage />);

      expect(
        screen.getByText(
          "Instalá Remy's en tu pantalla de inicio para una experiencia más rápida, como una app nativa."
        )
      ).toBeInTheDocument();
      // t.rich, so the emphasis sits where the Spanish sentence needs it
      expect(screen.getByText('ícono de instalación').tagName).toBe('STRONG');
    });
  });

  describe('ChangePasswordDialog', () => {
    it('should label its fields and its buttons in Spanish', () => {
      renderInSpanish(<ChangePasswordDialog open onClose={jest.fn()} />);

      expect(
        screen.getByText(
          'Tu contraseña tiene que tener al menos 8 caracteres e incluir mayúsculas, minúsculas y números.'
        )
      ).toBeInTheDocument();
      expect(screen.getByLabelText('Contraseña actual')).toBeInTheDocument();
      expect(screen.getByLabelText(/^Contraseña nueva/)).toBeInTheDocument();
      expect(screen.getByLabelText(/^Confirmá la contraseña nueva/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cambiar contraseña' })).toBeInTheDocument();
    });

    it('should report its validation in Spanish', () => {
      renderInSpanish(<ChangePasswordDialog open onClose={jest.fn()} />);

      fireEvent.change(screen.getByLabelText('Contraseña actual'), {
        target: { value: 'OldPass123' },
      });
      fireEvent.change(screen.getByLabelText(/^Contraseña nueva/), {
        target: { value: 'newpass123' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));

      expect(
        screen.getByText('La contraseña tiene que tener al menos una mayúscula')
      ).toBeInTheDocument();
      expect(screen.getByText('Confirmá tu contraseña nueva')).toBeInTheDocument();
    });

    it("should show the server's error code in Spanish rather than its English sentence", async () => {
      const mockFetch = global.fetch as jest.Mock;
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: 'Current password is incorrect',
          code: 'currentPasswordIncorrect',
        }),
      });
      renderInSpanish(<ChangePasswordDialog open onClose={jest.fn()} />);

      fireEvent.change(screen.getByLabelText('Contraseña actual'), {
        target: { value: 'OldPass123' },
      });
      fireEvent.change(screen.getByLabelText(/^Contraseña nueva/), {
        target: { value: 'NewPass123' },
      });
      fireEvent.change(screen.getByLabelText(/^Confirmá la contraseña nueva/), {
        target: { value: 'NewPass123' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));

      await waitFor(() =>
        expect(mockShowError).toHaveBeenCalledWith('La contraseña actual no es correcta')
      );
    });
  });
});
