import { ThemeProvider, createTheme } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { ToastProvider } from '@/contexts/ToastContext';
import ProfilePage from '../[username]/page';
import '@testing-library/jest-dom';

/**
 * The profile page's behaviour. Before this file it had only its Spanish test, which is
 * why a private profile could crash it without anything noticing.
 */

const mockPush = jest.fn();
let mockUsername = 'ana';
jest.mock('next/navigation', () => ({
  useParams: () => ({ username: mockUsername }),
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
}));

let mockViewer: { username: string } | null = { username: 'someone-else' };
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockViewer, isAuthenticated: mockViewer !== null }),
}));

jest.mock('@/components/profile/EditProfileModal', () => () => null);
jest.mock('@/components/profile/CookingLog', () => () => null);

const viewer = (liked: boolean) => ({
  liked,
  saved: false,
  timesCooked: 0,
  lastCookedAt: null,
  myRating: null,
});

const recipe = (id: string, liked = false) => ({
  id,
  title: `Receta ${id}`,
  description: null,
  imageUrl: '/r.jpg',
  difficulty: 'easy',
  prepTime: null,
  cookingTime: null,
  servings: null,
  likeCount: 3,
  commentCount: 0,
  viewer: viewer(liked),
});

const publicProfile = (over: Record<string, unknown> = {}) => ({
  user: { id: 'u1', username: 'ana', fullName: 'Ana', bio: null, avatar: null, website: null },
  stats: { recipesCount: 1, followersCount: 7, followingCount: 2 },
  recipes: [recipe('r1')],
  isFollowing: false,
  isOwnProfile: false,
  ...over,
});

/** Exactly the route's private branch: the person, and nothing about their recipes. */
const privateProfile = {
  user: { id: 'u1', username: 'ana', fullName: 'Ana', avatar: null, bio: null, isPrivate: true },
  recipes: [],
  isOwnProfile: false,
  isPrivateProfile: true,
};

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const fail = (status: number) => ({ ok: false, status, json: async () => ({}) });

const findStat = (sentence: string) =>
  screen.findByText((_, element) => element?.tagName === 'P' && element?.textContent === sentence);

function renderPage() {
  const queryClient = new QueryClient({
    // `retryDelay` rather than `retry`: the hook sets its own retry rule, which a client
    // default cannot switch off. This keeps the one retry it allows instant.
    defaultOptions: { queries: { retry: false, retryDelay: 0 }, mutations: { retry: false } },
  });
  const tree = () => (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={createTheme()}>
        <ToastProvider>
          <ProfilePage />
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
  const view = render(tree());
  // The same page instance with new params: what following a link to another profile does.
  return { queryClient, rerender: () => view.rerender(tree()) };
}

describe('the profile page', () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = global.fetch as jest.Mock;
    mockFetch.mockReset();
    mockPush.mockReset();
    mockViewer = { username: 'someone-else' };
    mockUsername = 'ana';
  });

  it("shows the reader's own hearts as they are, filled where they already liked", async () => {
    // The page once hardcoded `viewer={null}` on both tabs while the route sent the real
    // state, so on your own profile your own liked recipes showed empty hearts.
    mockFetch.mockResolvedValue(ok(publicProfile({ recipes: [recipe('r1', true)] })));

    renderPage();

    expect(await screen.findByRole('button', { name: 'Unlike' })).toBeInTheDocument();
  });

  it('shows the profile that was asked for last, even when an earlier one answers after it', async () => {
    // Two profiles, two cache entries: the slow answer for the first lands in its own entry
    // and the page is reading the second. The old read had no abort and no stale check.
    let answerAna: (value: unknown) => void = () => {};
    mockFetch.mockImplementation((url: string) =>
      url.includes('/users/ana/')
        ? new Promise((resolve) => {
            answerAna = resolve;
          })
        : Promise.resolve(
            ok(
              publicProfile({
                user: { id: 'u2', username: 'bea', fullName: 'Bea' },
                recipes: [recipe('b1')],
              })
            )
          )
    );

    const { rerender } = renderPage();
    mockUsername = 'bea';
    rerender();
    expect(await screen.findByRole('heading', { name: 'bea' })).toBeInTheDocument();

    // Long enough for the late answer to be parsed and reach state, if anything lets it.
    await act(async () => {
      answerAna(ok(publicProfile()));
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(screen.getByRole('heading', { name: 'bea' })).toBeInTheDocument();
    expect(screen.getByText('Receta b1')).toBeInTheDocument();
    expect(screen.queryByText('Receta r1')).not.toBeInTheDocument();
  });

  describe('a private profile seen by someone else', () => {
    it('says it is private instead of crashing', async () => {
      // Reproduced before the fix: the page stored the answer's missing `stats` as its
      // stats, read `stats.recipesCount`, and threw — a blank page for anyone opening a
      // private profile. The route has always sent this smaller payload for that case.
      mockFetch.mockResolvedValue(ok(privateProfile));

      renderPage();

      expect(await screen.findByText('This profile is private')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'ana' })).toBeInTheDocument();
    });

    it('shows no counts, no tabs and no follow button, because it was sent none of them', async () => {
      mockFetch.mockResolvedValue(ok(privateProfile));

      renderPage();

      await screen.findByText('This profile is private');
      expect(screen.queryByText(/followers/)).not.toBeInTheDocument();
      expect(screen.queryByRole('tab')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Follow' })).not.toBeInTheDocument();
    });
  });

  describe('a heart on a profile card', () => {
    it('fills in before the server answers', async () => {
      // What moving the lists into the cache is for. They lived in `useState`, which the
      // shared mutation layer cannot see, and the cards were given no `onLike` at all.
      let answerLike: (value: unknown) => void = () => {};
      mockFetch.mockImplementation((url: string) =>
        url.includes('/like')
          ? new Promise((resolve) => {
              answerLike = resolve;
            })
          : Promise.resolve(ok(publicProfile()))
      );

      renderPage();
      fireEvent.click(await screen.findByRole('button', { name: 'Like' }));

      expect(await screen.findByRole('button', { name: 'Unlike' })).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();

      answerLike(ok({ liked: true, likeCount: 4 }));
    });

    it('takes the heart back and says why when there is no connection', async () => {
      mockFetch.mockImplementation((url: string) =>
        url.includes('/like')
          ? Promise.reject(new TypeError('Failed to fetch'))
          : Promise.resolve(ok(publicProfile()))
      );

      renderPage();
      fireEvent.click(await screen.findByRole('button', { name: 'Like' }));

      expect(
        await screen.findByText("No connection — the like didn't go through")
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Like' })).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  describe('following', () => {
    it('flips at once and settles on the count the server sends', async () => {
      let answerFollow: (value: unknown) => void = () => {};
      mockFetch.mockImplementation((url: string) =>
        url.endsWith('/follow')
          ? new Promise((resolve) => {
              answerFollow = resolve;
            })
          : Promise.resolve(ok(publicProfile()))
      );

      renderPage();
      fireEvent.click(await screen.findByRole('button', { name: 'Follow' }));

      // Before the server answers — it has not, `answerFollow` is still pending — and not
      // behind a "Loading…" label either, which is what the old button printed over its
      // own optimistic flip.
      expect(await screen.findByRole('button', { name: 'Following' })).toBeInTheDocument();
      expect(await findStat('8 followers')).toBeInTheDocument();

      // Someone else followed in the meantime; the guess was 8, the truth is 9.
      answerFollow(ok({ success: true, followersCount: 9 }));
      expect(await findStat('9 followers')).toBeInTheDocument();
    });

    it('takes the follow back AND says so when the server refuses', async () => {
      // It used to change the button back with nothing but a console.error: the reader saw
      // it undo itself and was never told why.
      mockFetch.mockImplementation((url: string) =>
        url.endsWith('/follow') ? Promise.resolve(fail(500)) : Promise.resolve(ok(publicProfile()))
      );

      renderPage();
      fireEvent.click(await screen.findByRole('button', { name: 'Follow' }));

      expect(await screen.findByText('Failed to follow user')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Follow' })).toBeInTheDocument();
      expect(await findStat('7 followers')).toBeInTheDocument();
    });

    it('names the connection when that is what failed', async () => {
      mockFetch.mockImplementation((url: string) =>
        url.endsWith('/unfollow')
          ? Promise.reject(new TypeError('Failed to fetch'))
          : Promise.resolve(ok(publicProfile({ isFollowing: true })))
      );

      renderPage();
      fireEvent.click(await screen.findByRole('button', { name: 'Following' }));

      expect(
        await screen.findByText("No connection — you're still following them")
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Following' })).toBeInTheDocument();
    });

    it('keeps a heart tapped during a failed follow', async () => {
      // The rollback rewrites the two follow fields, not the whole cached profile. A
      // snapshot restore would have put the heart back to empty along with the button.
      let refuseFollow: (value: unknown) => void = () => {};
      mockFetch.mockImplementation((url: string) => {
        if (url.endsWith('/follow')) {
          return new Promise((resolve) => {
            refuseFollow = resolve;
          });
        }
        if (url.includes('/like')) return Promise.resolve(ok({ liked: true, likeCount: 4 }));
        return Promise.resolve(ok(publicProfile()));
      });

      renderPage();
      fireEvent.click(await screen.findByRole('button', { name: 'Follow' }));
      fireEvent.click(screen.getByRole('button', { name: 'Like' }));
      await screen.findByRole('button', { name: 'Unlike' });

      refuseFollow(fail(500));

      expect(await screen.findByText('Failed to follow user')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Unlike' })).toBeInTheDocument();
    });

    it('sends a signed-out reader to sign in rather than trying', async () => {
      mockViewer = null;
      mockFetch.mockResolvedValue(ok(publicProfile()));

      renderPage();
      fireEvent.click(await screen.findByRole('button', { name: 'Follow' }));

      expect(mockPush).toHaveBeenCalledWith('/auth');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('your Saved tab', () => {
    const saved = (id: string) => ({
      ...recipe(id),
      title: `Guardada ${id}`,
      viewer: { ...viewer(false), saved: true },
    });
    const own = (list: unknown[]) =>
      publicProfile({ recipes: [], savedRecipes: list, isFollowing: undefined });

    const openSavedTab = async () => {
      fireEvent.click(await screen.findByText('Saved'));
      await screen.findByText('Guardada s1');
    };

    beforeEach(() => {
      mockViewer = { username: 'ana' };
    });

    it('lets go of a recipe the moment you unsave it, before the server answers', async () => {
      // Lucas's call: unsaving from here takes the recipe out at once, like every other
      // tap in this layer — not an empty bookmark sitting there until a reload.
      let answerSave: (value: unknown) => void = () => {};
      mockFetch.mockImplementation((url: string) =>
        url.includes('/save')
          ? new Promise((resolve) => {
              answerSave = resolve;
            })
          : Promise.resolve(ok(own([saved('s1'), saved('s2')])))
      );

      renderPage();
      await openSavedTab();
      fireEvent.click(screen.getAllByRole('button', { name: 'Remove from saved' })[0]);

      await waitFor(() => expect(screen.queryByText('Guardada s1')).not.toBeInTheDocument());
      expect(screen.getByText('Guardada s2')).toBeInTheDocument();
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/recipes/s1/save',
        expect.objectContaining({ body: JSON.stringify({ saved: false }) })
      );

      answerSave(ok({ saved: false }));
    });

    it('brings it back, and says it is still saved, when the unsave fails', async () => {
      // The server's catch-all code is "recipe.saveFailed" in both directions; translated as
      // is, it would have told the reader "we could not save the recipe" about one that
      // still is saved.
      mockFetch.mockImplementation((url: string) =>
        url.includes('/save')
          ? Promise.resolve({
              ok: false,
              status: 500,
              json: async () => ({ error: 'Failed to save recipe', code: 'recipe.saveFailed' }),
            })
          : Promise.resolve(ok(own([saved('s1')])))
      );

      renderPage();
      await openSavedTab();
      fireEvent.click(screen.getByRole('button', { name: 'Remove from saved' }));

      expect(
        await screen.findByText("We couldn't remove it from your saved recipes")
      ).toBeInTheDocument();
      expect(screen.getByText('Guardada s1')).toBeInTheDocument();
    });

    it('says the recipe is still there when the unsave fails for want of a connection', async () => {
      mockFetch.mockImplementation((url: string) =>
        url.includes('/save')
          ? Promise.reject(new TypeError('Failed to fetch'))
          : Promise.resolve(ok(own([saved('s1')])))
      );

      renderPage();
      await openSavedTab();
      fireEvent.click(screen.getByRole('button', { name: 'Remove from saved' }));

      expect(
        await screen.findByText("No connection — it's still in your saved recipes")
      ).toBeInTheDocument();
      expect(screen.getByText('Guardada s1')).toBeInTheDocument();
    });

    it('shows its empty state once the last one goes', async () => {
      // The tab never needed one mid-visit before: it could not change while you looked.
      mockFetch.mockImplementation((url: string) =>
        url.includes('/save')
          ? Promise.resolve(ok({ saved: false }))
          : Promise.resolve(ok(own([saved('s1')])))
      );

      renderPage();
      await openSavedTab();
      fireEvent.click(screen.getByRole('button', { name: 'Remove from saved' }));

      expect(await screen.findByText('No saved recipes yet')).toBeInTheDocument();
    });
  });

  describe('when the profile will not load', () => {
    it('says the person does not exist, asks only once, and offers no retry', async () => {
      mockFetch.mockResolvedValue(fail(404));

      renderPage();

      expect(await screen.findByText('User not found')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('offers to try again when it simply failed, and trying again works', async () => {
      mockFetch.mockResolvedValue(fail(500));

      renderPage();

      fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
      mockFetch.mockResolvedValue(ok(publicProfile()));

      expect(await screen.findByText('Receta r1')).toBeInTheDocument();
    });

    it('shows a sized placeholder while loading, not an empty page', async () => {
      mockFetch.mockReturnValue(new Promise(() => {}));

      renderPage();

      expect(screen.getByRole('status', { name: 'Loading...' })).toBeInTheDocument();
    });
  });
});
