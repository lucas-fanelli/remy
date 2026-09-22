import { ThemeProvider, createTheme } from '@mui/material/styles';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { renderWithLocale } from '@/i18n/testing';
import AdminDashboard from '../page';
import AdminUsersPage from '../users/page';

/**
 * The admin screens are the owner's own, but they are part of the app and follow the locale
 * like everything else. This file is their only copy test, so it covers the three things a
 * translation can quietly get wrong: a key that does not exist (tsconfig.i18n.json turns
 * that into a compile error), a plural that agrees with the wrong number, and a date that
 * silently keeps formatting in English.
 */

jest.mock('@/hooks/useAdminGuard', () => ({
  useAdminGuard: () => ({ isReady: true, isLoading: false }),
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'admin-1', username: 'lucas' },
    isAdmin: true,
    isLoading: false,
  }),
}));

const mockFetch = global.fetch as jest.Mock;

/** Afternoon in Madrid, so the pinned time zone cannot move it to another day */
const ISO = '2024-01-15T15:00:00.000Z';

const theme = createTheme();

const renderInSpanish = (ui: React.ReactElement) =>
  renderWithLocale(
    (element) => render(<ThemeProvider theme={theme}>{element}</ThemeProvider>),
    'es',
    ui
  );

const respondWith = (body: unknown) =>
  mockFetch.mockResolvedValue({ ok: true, json: async () => body });

describe('Admin dashboard in Spanish', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should greet the admin and label every card in Spanish', async () => {
    respondWith({
      totalUsers: 12,
      totalAdmins: 1,
      totalRecipes: 30,
      totalComments: 4,
      totalLikes: 7,
      newUsersToday: 2,
      newRecipesToday: 3,
    });

    renderInSpanish(<AdminDashboard />);

    expect(await screen.findByText('Panel de administración')).toBeInTheDocument();
    expect(
      screen.getByText('Hola de nuevo, lucas. Este es el resumen de tu plataforma.')
    ).toBeInTheDocument();
    expect(screen.getByText('Total de usuarios')).toBeInTheDocument();
    expect(screen.getByText('Nuevos hoy')).toBeInTheDocument();
    expect(screen.getByText('Gestión')).toBeInTheDocument();
    expect(screen.getByText('Gestionar recetas')).toBeInTheDocument();
    expect(screen.getByText('Ver o eliminar comentarios')).toBeInTheDocument();
  });

  it('should report a failed stats request in Spanish', async () => {
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({}) });

    renderInSpanish(<AdminDashboard />);

    expect(await screen.findByText('No pudimos cargar las estadísticas')).toBeInTheDocument();
  });
});

describe('Admin users page in Spanish', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the table chrome, the role label and the date in Spanish', async () => {
    respondWith({
      users: [
        {
          id: 'user-1',
          email: 'ana@example.com',
          username: 'ana',
          fullName: 'Ana Gómez',
          avatar: null,
          role: 'ADMIN',
          isVerified: true,
          createdAt: ISO,
          _count: { posts: 3, comments: 1, followers: 5, following: 2 },
        },
      ],
      total: 1,
    });

    renderInSpanish(<AdminUsersPage />);

    expect(await screen.findByText('ana')).toBeInTheDocument();
    expect(screen.getByText('Gestionar usuarios')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Buscar usuarios...')).toBeInTheDocument();
    expect(screen.getByText('Seguidores')).toBeInTheDocument();
    expect(screen.getByText('Miembro desde')).toBeInTheDocument();
    // The stored role stays 'ADMIN'; only its label follows the language
    expect(screen.getByText('Administrador')).toBeInTheDocument();
    expect(screen.getByText('15 ene 2024')).toBeInTheDocument();
    expect(screen.getByText('Filas por página:')).toBeInTheDocument();
    // One row: the `one` branch of the plural, with the noun agreeing with the number
    expect(screen.getByText('1–1 de 1 usuario')).toBeInTheDocument();
  });

  it('should agree the row-count plural with more than one user', async () => {
    respondWith({
      users: [
        { id: 'user-1', email: 'a@example.com', username: 'ana', role: 'USER', createdAt: ISO },
        { id: 'user-2', email: 'b@example.com', username: 'beto', role: 'USER', createdAt: ISO },
      ],
      total: 2,
    });

    renderInSpanish(<AdminUsersPage />);

    expect(await screen.findByText('beto')).toBeInTheDocument();
    expect(screen.getByText('1–2 de 2 usuarios')).toBeInTheDocument();
  });

  it('should render the empty state in Spanish', async () => {
    respondWith({ users: [], total: 0 });

    renderInSpanish(<AdminUsersPage />);

    expect(await screen.findByText('No encontramos usuarios')).toBeInTheDocument();
  });

  it('should ask for confirmation in Spanish before deleting a user', async () => {
    respondWith({
      users: [
        {
          id: 'user-1',
          email: 'ana@example.com',
          username: 'ana',
          fullName: null,
          avatar: null,
          role: 'USER',
          isVerified: true,
          createdAt: ISO,
        },
      ],
      total: 1,
    });

    renderInSpanish(<AdminUsersPage />);

    fireEvent.click(await screen.findByLabelText('Eliminar usuario'));

    await waitFor(() => {
      expect(screen.getByText('Eliminar usuario')).toBeInTheDocument();
    });
    expect(screen.getByText(/¿Seguro que querés eliminar a/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Eliminar' })).toBeInTheDocument();
  });
});
