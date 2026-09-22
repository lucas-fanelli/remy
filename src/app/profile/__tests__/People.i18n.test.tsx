import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import React from 'react';
import { testQueryClient } from '@/__tests__/helpers/queryClient';
import { ToastProvider } from '@/contexts/ToastContext';
import { renderWithLocale } from '@/i18n/testing';
import FollowersPage from '../[username]/followers/page';
import FollowingPage from '../[username]/following/page';

/**
 * The two people lists in Spanish. ProfilePage.i18n.test.tsx covers the header these pages
 * are reached from; this file covers what only they render - the titles, the person-neutral
 * empty states, the sign-in prompt, the load failures, the lock on a private account's list
 * and, the part worth a test of its own, every arm of the `profile.followFailed` and
 * `profile.followOffline` selects a row can reach. peoplePages.test.tsx covers what the
 * rows DO.
 */

const mockUseAuth = jest.fn();
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('next/navigation', () => ({
  useParams: () => ({ username: 'ana' }),
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));

type FollowState = 'none' | 'requested' | 'following';

const person = (id: string, username: string, isPrivate: boolean, followState: FollowState) => ({
  id,
  username,
  fullName: null,
  avatar: null,
  bio: null,
  isPrivate,
  followState,
  isFollowing: followState === 'following',
});

/** One row per label: "Seguir", "Siguiendo" and "Solicitado". */
const people = [
  person('u1', 'bruno', false, 'none'),
  person('u2', 'clara', false, 'following'),
  person('u3', 'dani', true, 'requested'),
];

const mockFetch = jest.fn();

const signedIn = { isAuthenticated: true, isLoading: false, user: { username: 'vera' } };
const signedInAsOwner = { isAuthenticated: true, isLoading: false, user: { username: 'ana' } };

const listOf = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

/** Every GET answers the list; a follow/unfollow POST fails, which is what the tests below need. */
const withFailingToggle = (list: unknown) =>
  mockFetch.mockImplementation((_url: string, init?: RequestInit) =>
    init?.method === 'POST'
      ? Promise.resolve({ ok: false, status: 500, json: async () => ({}) })
      : Promise.resolve(listOf(list))
  );

/** Every GET answers the list; every POST fails to leave, as with no connection. */
const withOfflineToggle = (list: unknown) =>
  mockFetch.mockImplementation((_url: string, init?: RequestInit) =>
    init?.method === 'POST'
      ? Promise.reject(new TypeError('Failed to fetch'))
      : Promise.resolve(listOf(list))
  );

/** A private account's list, refused to someone who does not follow it. */
const privateList = () =>
  mockFetch.mockResolvedValue({
    ok: false,
    status: 403,
    json: async () => ({ error: 'This profile is private', code: 'user.profilePrivate' }),
  });

/** A fresh one per test, so nothing cached leaks from one test into the next. */
let queryClient: QueryClient;
beforeEach(() => {
  queryClient = testQueryClient();
});

/** The pages write through React Query now, and a failure says so in a toast. */
const providers = (ui: React.ReactElement) => (
  <QueryClientProvider client={queryClient}>
    <ToastProvider>{ui}</ToastProvider>
  </QueryClientProvider>
);

const renderInSpanish = (ui: React.ReactElement) =>
  renderWithLocale((element) => render(providers(element)), 'es', ui);

/** The pages log nothing today, but a failure's noise must not hide the copy under test. */
const silenceConsole = () => jest.spyOn(console, 'error').mockImplementation(() => {});

describe('Followers page in Spanish', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockFetch as unknown as typeof fetch;
    mockFetch.mockResolvedValue(listOf({ followers: people }));
    mockUseAuth.mockReturnValue(signedIn);
  });

  it('should title the list and label all three follow buttons in Spanish', async () => {
    renderInSpanish(<FollowersPage />);

    expect(screen.getByRole('heading', { name: 'Seguidores' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Seguir' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Siguiendo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Solicitado' })).toBeInTheDocument();
  });

  it('should say it is loading while the rows are still skeletons', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));

    renderInSpanish(<FollowersPage />);

    expect(screen.getByRole('status', { name: 'Cargando...' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Volver' })).toBeInTheDocument();
  });

  it('should word the empty state without naming whose profile it is', async () => {
    mockFetch.mockResolvedValue(listOf({ followers: [] }));

    renderInSpanish(<FollowersPage />);

    expect(await screen.findByText('Todavía no hay seguidores')).toBeInTheDocument();
  });

  it('should explain a failed load in Spanish', async () => {
    const consoleErrorSpy = silenceConsole();
    mockFetch.mockRejectedValue(new Error('network'));

    renderInSpanish(<FollowersPage />);

    expect(await screen.findByText('No pudimos cargar los seguidores')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Volver' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    consoleErrorSpy.mockRestore();
  });

  it('should show a private account’s lock, and the way to its profile, instead of a failure', async () => {
    privateList();

    renderInSpanish(<FollowersPage />);

    expect(await screen.findByText('Este perfil es privado')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver su perfil' })).toHaveAttribute(
      'href',
      '/profile/ana'
    );
    // The profile's call to action asks for a follow this page has no button for.
    expect(screen.queryByText('Seguí esta cuenta para ver sus recetas.')).not.toBeInTheDocument();
    expect(screen.queryByText('No pudimos cargar los seguidores')).not.toBeInTheDocument();
  });

  it('should ask a visitor who arrives signed out to sign in', () => {
    // The common case, and the one that used to render a blank page forever: the page
    // checked its own `loading` before the session, and only the fetch clears `loading` —
    // a fetch a signed-out visitor never makes.
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: false, user: null });

    renderInSpanish(<FollowersPage />);

    expect(screen.getByText('Iniciá sesión para ver los seguidores')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });

  it('should ask a visitor whose session drops while the page is open to sign in', async () => {
    const { rerender } = renderInSpanish(<FollowersPage />);
    await screen.findByRole('button', { name: 'Seguir' });

    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: false, user: null });
    rerender(providers(<FollowersPage />));

    expect(screen.getByText('Iniciá sesión para ver los seguidores')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });

  it('should report a failed follow in Spanish', async () => {
    const consoleErrorSpy = silenceConsole();
    withFailingToggle({ followers: people });

    renderInSpanish(<FollowersPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Seguir' }));

    expect(await screen.findByText('No pudimos seguir a esta persona')).toBeInTheDocument();
    consoleErrorSpy.mockRestore();
  });

  it('should report a failed unfollow with the other branch of the select', async () => {
    const consoleErrorSpy = silenceConsole();
    withFailingToggle({ followers: people });

    renderInSpanish(<FollowersPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Siguiendo' }));

    expect(
      await screen.findByText('No pudimos dejar de seguir a esta persona')
    ).toBeInTheDocument();
    consoleErrorSpy.mockRestore();
  });

  it('should paint "Solicitado" at once on a private row, and word a failed request', async () => {
    // The refusal is held back until the paint has been seen.
    let refuse: () => void = () => {};
    const refusal = new Promise((resolve) => {
      refuse = () => resolve({ ok: false, status: 500, json: async () => ({}) });
    });
    mockFetch.mockImplementation((_url: string, init?: RequestInit) =>
      init?.method === 'POST'
        ? refusal
        : Promise.resolve(listOf({ followers: [person('u4', 'eva', true, 'none')] }))
    );

    renderInSpanish(<FollowersPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Seguir' }));

    expect(await screen.findByRole('button', { name: 'Solicitado' })).toBeInTheDocument();
    refuse();
    expect(await screen.findByText('No pudimos enviar la solicitud')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Seguir' })).toBeInTheDocument();
  });

  it('should say a cancel that never left leaves the request pending', async () => {
    withOfflineToggle({ followers: people });

    renderInSpanish(<FollowersPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Solicitado' }));

    expect(
      await screen.findByText('Sin conexión — tu solicitud sigue pendiente')
    ).toBeInTheDocument();
  });

  it('should ask in Spanish before unfollowing a private account', async () => {
    mockFetch.mockResolvedValue(listOf({ followers: [person('u5', 'fede', true, 'following')] }));

    renderInSpanish(<FollowersPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Siguiendo' }));

    const dialog = screen.getByRole('dialog', { name: '¿Dejar de seguir a fede?' });
    expect(within(dialog).getByRole('button', { name: 'Dejar de seguir' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
  });

  describe('on your own list', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue(signedInAsOwner);
    });

    it('should offer "Eliminar" and ask in Spanish, saying the person will not be told', async () => {
      renderInSpanish(<FollowersPage />);
      const [first] = await screen.findAllByRole('button', { name: 'Eliminar' });
      fireEvent.click(first);

      const dialog = screen.getByRole('dialog', {
        name: '¿Eliminar a bruno de tus seguidores?',
      });
      expect(
        within(dialog).getByText(
          'No le vamos a avisar. Si tu cuenta es privada, va a dejar de ver tus recetas.'
        )
      ).toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: 'Eliminar' })).toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
    });

    it('should put the follower back and say so in Spanish when the removal fails', async () => {
      withFailingToggle({ followers: people });

      renderInSpanish(<FollowersPage />);
      const [first] = await screen.findAllByRole('button', { name: 'Eliminar' });
      fireEvent.click(first);
      fireEvent.click(
        within(
          screen.getByRole('dialog', { name: '¿Eliminar a bruno de tus seguidores?' })
        ).getByRole('button', { name: 'Eliminar' })
      );

      expect(await screen.findByText('No pudimos eliminar a este seguidor')).toBeInTheDocument();
      await waitFor(() => expect(screen.getByText('@bruno')).toBeInTheDocument());
    });

    it('should say in Spanish that a removal that never left kept the follower', async () => {
      withOfflineToggle({ followers: people });

      renderInSpanish(<FollowersPage />);
      const [first] = await screen.findAllByRole('button', { name: 'Eliminar' });
      fireEvent.click(first);
      fireEvent.click(
        within(
          screen.getByRole('dialog', { name: '¿Eliminar a bruno de tus seguidores?' })
        ).getByRole('button', { name: 'Eliminar' })
      );

      expect(
        await screen.findByText('Sin conexión — sigue siendo tu seguidor')
      ).toBeInTheDocument();
      await waitFor(() => expect(screen.getByText('@bruno')).toBeInTheDocument());
    });
  });
});

describe('Following page in Spanish', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockFetch as unknown as typeof fetch;
    mockFetch.mockResolvedValue(listOf({ following: people }));
    mockUseAuth.mockReturnValue(signedIn);
  });

  it('should title the list in Spanish', async () => {
    renderInSpanish(<FollowingPage />);

    expect(screen.getByRole('heading', { name: 'Siguiendo' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Seguir' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Solicitado' })).toBeInTheDocument();
  });

  it('should word its empty state without naming whose profile it is', async () => {
    mockFetch.mockResolvedValue(listOf({ following: [] }));

    renderInSpanish(<FollowingPage />);

    expect(await screen.findByText('Todavía no hay nadie acá')).toBeInTheDocument();
  });

  it('should explain a failed load in Spanish', async () => {
    const consoleErrorSpy = silenceConsole();
    mockFetch.mockRejectedValue(new Error('network'));

    renderInSpanish(<FollowingPage />);

    expect(await screen.findByText('No pudimos cargar a quién sigue')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Volver' })).toBeInTheDocument();
    consoleErrorSpy.mockRestore();
  });

  it('should show a private account’s lock, and the way to its profile, instead of a failure', async () => {
    privateList();

    renderInSpanish(<FollowingPage />);

    expect(await screen.findByText('Este perfil es privado')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver su perfil' })).toHaveAttribute(
      'href',
      '/profile/ana'
    );
    expect(screen.queryByText('No pudimos cargar a quién sigue')).not.toBeInTheDocument();
  });

  it('should ask a visitor who arrives signed out to sign in', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: false, user: null });

    renderInSpanish(<FollowingPage />);

    expect(screen.getByText('Iniciá sesión para ver a quién sigue')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });

  it('should ask a visitor whose session drops while the page is open to sign in', async () => {
    const { rerender } = renderInSpanish(<FollowingPage />);
    await screen.findByRole('button', { name: 'Seguir' });

    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: false, user: null });
    rerender(providers(<FollowingPage />));

    expect(screen.getByText('Iniciá sesión para ver a quién sigue')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });

  it('should not offer "Eliminar", even on your own list', async () => {
    mockUseAuth.mockReturnValue(signedInAsOwner);

    renderInSpanish(<FollowingPage />);

    await screen.findByRole('button', { name: 'Seguir' });
    expect(screen.queryByRole('button', { name: 'Eliminar' })).not.toBeInTheDocument();
  });
});
