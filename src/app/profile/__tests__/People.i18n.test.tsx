import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { renderWithLocale } from '@/i18n/testing';
import FollowersPage from '../[username]/followers/page';
import FollowingPage from '../[username]/following/page';

/**
 * The two people lists in Spanish. ProfilePage.i18n.test.tsx covers the header these pages
 * are reached from; this file covers what only they render - the titles, the person-neutral
 * empty states, the sign-in prompt, the load failures and, the part worth a test of its own,
 * both branches of the `profile.followFailed` select.
 */

const mockUseAuth = jest.fn();
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('next/navigation', () => ({
  useParams: () => ({ username: 'ana' }),
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));

const people = [
  { id: 'u1', username: 'bruno', fullName: 'Bruno', avatar: null, bio: null, isFollowing: false },
  { id: 'u2', username: 'clara', fullName: null, avatar: null, bio: null, isFollowing: true },
];

const mockFetch = jest.fn();

const signedIn = { isAuthenticated: true, isLoading: false, user: { username: 'ana' } };

const listOf = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

/** Every GET answers the list; a follow/unfollow POST fails, which is what the tests below need. */
const withFailingToggle = (list: unknown) =>
  mockFetch.mockImplementation((_url: string, init?: RequestInit) =>
    init?.method === 'POST'
      ? Promise.resolve({ ok: false, status: 500, json: async () => ({}) })
      : Promise.resolve(listOf(list))
  );

/** The pages log their failures; the assertions are on the copy, not on the noise. */
const silenceConsole = () => jest.spyOn(console, 'error').mockImplementation(() => {});

describe('Followers page in Spanish', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockFetch as unknown as typeof fetch;
    mockFetch.mockResolvedValue(listOf({ followers: people }));
    mockUseAuth.mockReturnValue(signedIn);
  });

  it('should title the list and label both follow buttons in Spanish', async () => {
    renderWithLocale(render, 'es', <FollowersPage />);

    expect(await screen.findByRole('heading', { name: 'Seguidores' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Seguir' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Siguiendo' })).toBeInTheDocument();
  });

  it('should word the empty state without naming whose profile it is', async () => {
    mockFetch.mockResolvedValue(listOf({ followers: [] }));

    renderWithLocale(render, 'es', <FollowersPage />);

    expect(await screen.findByText('Todavía no hay seguidores')).toBeInTheDocument();
  });

  it('should explain a failed load in Spanish', async () => {
    const consoleErrorSpy = silenceConsole();
    mockFetch.mockRejectedValue(new Error('network'));

    renderWithLocale(render, 'es', <FollowersPage />);

    expect(await screen.findByText('No pudimos cargar los seguidores')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Volver' })).toBeInTheDocument();
    consoleErrorSpy.mockRestore();
  });

  it('should ask a visitor who arrives signed out to sign in', () => {
    // The common case, and the one that used to render a blank page forever: the page
    // checked its own `loading` before the session, and only the fetch clears `loading` —
    // a fetch a signed-out visitor never makes.
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: false, user: null });

    renderWithLocale(render, 'es', <FollowersPage />);

    expect(screen.getByText('Iniciá sesión para ver los seguidores')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });

  it('should ask a visitor whose session drops while the page is open to sign in', async () => {
    const { rerender } = renderWithLocale(render, 'es', <FollowersPage />);
    await screen.findByRole('heading', { name: 'Seguidores' });

    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: false, user: null });
    rerender(<FollowersPage />);

    expect(screen.getByText('Iniciá sesión para ver los seguidores')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });

  it('should report a failed follow in Spanish', async () => {
    const consoleErrorSpy = silenceConsole();
    withFailingToggle({ followers: people });

    renderWithLocale(render, 'es', <FollowersPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Seguir' }));

    expect(await screen.findByText('No pudimos seguir a esta persona')).toBeInTheDocument();
    consoleErrorSpy.mockRestore();
  });

  it('should report a failed unfollow with the other branch of the select', async () => {
    const consoleErrorSpy = silenceConsole();
    withFailingToggle({ followers: people });

    renderWithLocale(render, 'es', <FollowersPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Siguiendo' }));

    expect(
      await screen.findByText('No pudimos dejar de seguir a esta persona')
    ).toBeInTheDocument();
    consoleErrorSpy.mockRestore();
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
    renderWithLocale(render, 'es', <FollowingPage />);

    expect(await screen.findByRole('heading', { name: 'Siguiendo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Seguir' })).toBeInTheDocument();
  });

  it('should word its empty state without naming whose profile it is', async () => {
    mockFetch.mockResolvedValue(listOf({ following: [] }));

    renderWithLocale(render, 'es', <FollowingPage />);

    expect(await screen.findByText('Todavía no hay nadie acá')).toBeInTheDocument();
  });

  it('should explain a failed load in Spanish', async () => {
    const consoleErrorSpy = silenceConsole();
    mockFetch.mockRejectedValue(new Error('network'));

    renderWithLocale(render, 'es', <FollowingPage />);

    expect(await screen.findByText('No pudimos cargar a quién sigue')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Volver' })).toBeInTheDocument();
    consoleErrorSpy.mockRestore();
  });

  it('should ask a visitor who arrives signed out to sign in', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: false, user: null });

    renderWithLocale(render, 'es', <FollowingPage />);

    expect(screen.getByText('Iniciá sesión para ver a quién sigue')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });

  it('should ask a visitor whose session drops while the page is open to sign in', async () => {
    const { rerender } = renderWithLocale(render, 'es', <FollowingPage />);
    await screen.findByRole('heading', { name: 'Siguiendo' });

    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: false, user: null });
    rerender(<FollowingPage />);

    expect(screen.getByText('Iniciá sesión para ver a quién sigue')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });
});
