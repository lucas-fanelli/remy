import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { ToastProvider } from '@/contexts/ToastContext';
import { renderWithLocale } from '@/i18n/testing';
import ProfilePage from '../[username]/page';

/**
 * The profile header in Spanish. The stats are the part worth a test of their own: each one
 * is a single ICU plural with the figure as a rich `<value>` tag, so this is what proves the
 * tag the message asks for is the tag the component hands it - and that one follower is not
 * "1 seguidores".
 */

const mockUseAuth = jest.fn();
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('@/components/profile/EditProfileModal', () => {
  return function MockEditProfileModal() {
    return null;
  };
});

jest.mock('next/navigation', () => ({
  useParams: () => ({ username: 'ana' }),
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));

const mockFetch = jest.fn();

/** The page reads through React Query now, and a follow that fails says so in a toast. */
const renderInSpanish = (ui: React.ReactElement) =>
  renderWithLocale(
    (element) =>
      render(
        <QueryClientProvider
          client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
          <ToastProvider>{element}</ToastProvider>
        </QueryClientProvider>
      ),
    'es',
    ui
  );

/**
 * A stat is one paragraph made of two nodes - the bold figure the `<value>` tag wraps and
 * the rest of the sentence - so it is matched on the paragraph's whole text.
 */
const findStat = (sentence: string) =>
  screen.findByText((_, element) => element?.tagName === 'P' && element?.textContent === sentence);

const profileResponse = (stats: Record<string, number>, recipes: unknown[] = []) => ({
  ok: true,
  status: 200,
  json: async () => ({
    user: { id: '1', username: 'ana', fullName: 'Ana', createdAt: new Date().toISOString() },
    stats,
    recipes,
    isFollowing: false,
  }),
});

describe('Profile page in Spanish', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockFetch as unknown as typeof fetch;
    mockUseAuth.mockReturnValue({ user: null, isAuthenticated: false });
  });

  it('should render each stat as one Spanish sentence', async () => {
    mockFetch.mockResolvedValue(
      profileResponse({ recipesCount: 3, followersCount: 1, followingCount: 5 })
    );

    renderInSpanish(<ProfilePage />);

    expect(await findStat('3 recetas')).toBeInTheDocument();
    expect(await findStat('1 seguidor')).toBeInTheDocument();
    expect(await findStat('5 siguiendo')).toBeInTheDocument();
  });

  it('should use the singular of "receta" for a single recipe', async () => {
    mockFetch.mockResolvedValue(
      profileResponse({ recipesCount: 1, followersCount: 2, followingCount: 0 })
    );

    renderInSpanish(<ProfilePage />);

    expect(await findStat('1 receta')).toBeInTheDocument();
    expect(await findStat('2 seguidores')).toBeInTheDocument();
  });

  it('should show the tabs, the follow button and the empty state in Spanish', async () => {
    mockFetch.mockResolvedValue(
      profileResponse({ recipesCount: 0, followersCount: 0, followingCount: 0 })
    );

    renderInSpanish(<ProfilePage />);

    expect(await screen.findByText('Recetas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Seguir' })).toBeInTheDocument();
    expect(screen.getByText('Todavía no hay recetas')).toBeInTheDocument();
  });

  it('should translate the difficulty chip without touching the stored value', async () => {
    mockFetch.mockResolvedValue(
      profileResponse({ recipesCount: 1, followersCount: 0, followingCount: 0 }, [
        {
          id: 'r1',
          title: 'Milanesas',
          imageUrl: '/milanesas.jpg',
          difficulty: 'easy',
          likesCount: 0,
          commentsCount: 0,
        },
      ])
    );

    renderInSpanish(<ProfilePage />);

    expect(await screen.findByText('fácil')).toBeInTheDocument();
  });

  describe('a private account', () => {
    /** The route's locked branch: the person, the counts, where the reader stands. */
    const lockedResponse = (followState: 'none' | 'requested' | null) => ({
      ok: true,
      status: 200,
      json: async () => ({
        user: { id: '1', username: 'ana', fullName: 'Ana', isPrivate: true },
        stats: { recipesCount: 4, followersCount: 1, followingCount: 2 },
        recipes: [],
        isOwnProfile: false,
        isPrivateProfile: true,
        followState,
      }),
    });

    it('should lock the recipes and invite a follow, with the counts still there', async () => {
      mockFetch.mockResolvedValue(lockedResponse(null));

      renderInSpanish(<ProfilePage />);

      expect(await screen.findByText('Este perfil es privado')).toBeInTheDocument();
      // The `other` arm of the select: signed out reads as nothing to wait for.
      expect(screen.getByText('Seguí esta cuenta para ver sus recetas.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Seguir' })).toBeInTheDocument();
      expect(await findStat('4 recetas')).toBeInTheDocument();
      expect(await findStat('1 seguidor')).toBeInTheDocument();
      expect(await findStat('2 siguiendo')).toBeInTheDocument();
    });

    it('should say a request is waiting, in voseo', async () => {
      mockUseAuth.mockReturnValue({ user: { username: 'vera' }, isAuthenticated: true });
      mockFetch.mockResolvedValue(lockedResponse('requested'));

      renderInSpanish(<ProfilePage />);

      expect(
        await screen.findByText('Cuando acepte tu solicitud, vas a ver sus recetas.')
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Solicitado' })).toBeInTheDocument();
    });

    it('should switch to "Solicitado" and its sentence the moment "Seguir" is tapped', async () => {
      mockUseAuth.mockReturnValue({ user: { username: 'vera' }, isAuthenticated: true });
      mockFetch.mockImplementation((url: string) =>
        url.endsWith('/follow') ? new Promise(() => {}) : Promise.resolve(lockedResponse('none'))
      );

      renderInSpanish(<ProfilePage />);
      fireEvent.click(await screen.findByRole('button', { name: 'Seguir' }));

      expect(await screen.findByRole('button', { name: 'Solicitado' })).toBeInTheDocument();
      expect(
        screen.getByText('Cuando acepte tu solicitud, vas a ver sus recetas.')
      ).toBeInTheDocument();
      // A request is not a follower: still one, still singular.
      expect(await findStat('1 seguidor')).toBeInTheDocument();
    });
  });

  it('should explain a missing profile in Spanish', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });

    renderInSpanish(<ProfilePage />);

    expect(await screen.findByText('No encontramos a esta persona')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Volver al inicio' })).toBeInTheDocument();
  });
});
