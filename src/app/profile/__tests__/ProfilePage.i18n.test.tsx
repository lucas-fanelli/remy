import { render, screen } from '@testing-library/react';
import React from 'react';
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

    renderWithLocale(render, 'es', <ProfilePage />);

    expect(await findStat('3 recetas')).toBeInTheDocument();
    expect(await findStat('1 seguidor')).toBeInTheDocument();
    expect(await findStat('5 siguiendo')).toBeInTheDocument();
  });

  it('should use the singular of "receta" for a single recipe', async () => {
    mockFetch.mockResolvedValue(
      profileResponse({ recipesCount: 1, followersCount: 2, followingCount: 0 })
    );

    renderWithLocale(render, 'es', <ProfilePage />);

    expect(await findStat('1 receta')).toBeInTheDocument();
    expect(await findStat('2 seguidores')).toBeInTheDocument();
  });

  it('should show the tabs, the follow button and the empty state in Spanish', async () => {
    mockFetch.mockResolvedValue(
      profileResponse({ recipesCount: 0, followersCount: 0, followingCount: 0 })
    );

    renderWithLocale(render, 'es', <ProfilePage />);

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

    renderWithLocale(render, 'es', <ProfilePage />);

    expect(await screen.findByText('fácil')).toBeInTheDocument();
  });

  it('should explain a missing profile in Spanish', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });

    renderWithLocale(render, 'es', <ProfilePage />);

    expect(await screen.findByText('No encontramos a esta persona')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Volver al inicio' })).toBeInTheDocument();
  });
});
