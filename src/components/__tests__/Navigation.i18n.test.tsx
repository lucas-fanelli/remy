import { ThemeProvider, createTheme } from '@mui/material/styles';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { renderWithLocale } from '@/i18n/testing';
import Footer from '../Footer';
import Navigation from '../Navigation';

/**
 * The counterpart of Navigation.test.tsx / Footer.test.tsx: those assert the ENGLISH copy and
 * were not touched by the migration, this one proves the very same components render Spanish
 * when the locale says so. Between them they cover both sides of every migrated string.
 */

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: jest.fn() }),
  usePathname: () => '/',
}));

const mockUseAuth = jest.fn();
jest.mock('@/contexts/AuthContext', () => ({
  AuthProvider: ({ children }: any) => <>{children}</>,
  useAuth: () => mockUseAuth(),
}));

jest.mock('@/contexts/ThemeContext', () => ({
  useThemeMode: () => ({ mode: 'light', toggleTheme: jest.fn() }),
}));

jest.mock('@/contexts/CreateRecipeContext', () => ({
  useCreateRecipeDialog: () => ({ openCreate: jest.fn() }),
}));

jest.mock('@/hooks/useNotificationPolling', () => ({
  useNotificationPolling: () => ({
    notifications: [],
    unreadCount: 0,
    fetchNotifications: jest.fn(),
    markAllAsRead: jest.fn(),
    markingAsRead: false,
    isPollingPaused: false,
    retryNow: jest.fn(),
    setNotifications: jest.fn(),
    setUnreadCount: jest.fn(),
  }),
}));

jest.mock('../search/PersistentSearchBar', () => {
  return function MockSearchBar({ placeholder }: { placeholder: string }) {
    return <input placeholder={placeholder} />;
  };
});

const theme = createTheme();

const renderInSpanish = (ui: React.ReactElement) =>
  renderWithLocale(
    (element) => render(<ThemeProvider theme={theme}>{element}</ThemeProvider>),
    'es',
    ui
  );

describe('Navigation in Spanish', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: { id: '1', username: 'tester', email: 'tester@test.com' },
      isAdmin: false,
      isAuthenticated: true,
      isLoading: false,
      logout: jest.fn(),
    });
  });

  it('should render the search placeholder in Spanish', () => {
    renderInSpanish(<Navigation />);

    expect(screen.getByPlaceholderText('Buscá recetas, ingredientes...')).toBeInTheDocument();
  });

  it('should label the navigation icons in Spanish', () => {
    renderInSpanish(<Navigation />);

    expect(screen.getByLabelText('Inicio')).toBeInTheDocument();
    expect(screen.getByLabelText('Despensa')).toBeInTheDocument();
    expect(screen.getByLabelText('Nueva receta')).toBeInTheDocument();
  });

  it('should render the account menu in Spanish', async () => {
    renderInSpanish(<Navigation />);

    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[buttons.length - 1]);

    await waitFor(() => {
      expect(screen.getByText('Perfil')).toBeInTheDocument();
    });
    expect(screen.getByText('Configuración')).toBeInTheDocument();
    expect(screen.getByText('Cerrar sesión')).toBeInTheDocument();
  });

  it('should offer the language switcher inside the account menu', async () => {
    renderInSpanish(<Navigation />);

    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[buttons.length - 1]);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'English' })).toBeInTheDocument();
    });
  });
});

describe('Footer in Spanish', () => {
  it('should render its links in Spanish', () => {
    renderInSpanish(<Footer />);

    expect(screen.getByText('Contacto')).toBeInTheDocument();
    expect(screen.getByText('Sobre nosotros')).toBeInTheDocument();
  });

  it('should render the contact dialog in Spanish', () => {
    renderInSpanish(<Footer />);

    fireEvent.click(screen.getByText('Contacto'));

    expect(screen.getByLabelText('Tu nombre')).toBeInTheDocument();
    expect(screen.getByLabelText('Mensaje')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar email' })).toBeInTheDocument();
  });
});
