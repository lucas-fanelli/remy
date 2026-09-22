import { ThemeProvider, createTheme } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { ToastProvider } from '@/contexts/ToastContext';
import ProfilePage from '../[username]/page';
import '@testing-library/jest-dom';

/**
 * The profile page's behaviour. Before this file it had only its Spanish test, which is
 * why a private profile could crash it without anything noticing.
 */

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useParams: () => ({ username: 'ana' }),
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

/**
 * Exactly the route's locked branch: the person, the counts and where the viewer stands,
 * and nothing about their recipes. `null` is what a signed-out reader is sent.
 */
const lockedProfile = (followState: 'none' | 'requested' | null = 'none') => ({
  user: { id: 'u1', username: 'ana', fullName: 'Ana', avatar: null, bio: null, isPrivate: true },
  stats: { recipesCount: 4, followersCount: 7, followingCount: 2 },
  recipes: [],
  isOwnProfile: false,
  isPrivateProfile: true,
  followState,
});
const privateProfile = lockedProfile();

/**
 * The route's full branch for a private account the viewer follows: the recipes, and
 * `isPrivate` still true — which is what makes unfollowing it ask first.
 */
const followerView = (followersCount = 7) =>
  publicProfile({
    user: {
      id: 'u1',
      username: 'ana',
      fullName: 'Ana',
      bio: null,
      avatar: null,
      website: null,
      isPrivate: true,
    },
    stats: { recipesCount: 1, followersCount, followingCount: 2 },
    followState: 'following',
    isFollowing: true,
  });

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const fail = (status: number) => ({ ok: false, status, json: async () => ({}) });

/** An answer the test hands over when it chooses to: the moment between a tap and its reply. */
function later() {
  let answer: (value: unknown) => void = () => {};
  let drop: () => void = () => {};
  const promise = new Promise((resolve, reject) => {
    answer = resolve;
    drop = () => reject(new TypeError('Failed to fetch'));
  });
  return { promise, answer, drop };
}

const findStat = (sentence: string) =>
  screen.findByText((_, element) => element?.tagName === 'P' && element?.textContent === sentence);

const LOCK_INVITE = 'Follow this account to see their recipes.';
const LOCK_WAITING = "Once they accept your request, you'll see their recipes.";

function renderPage() {
  const queryClient = new QueryClient({
    // `retryDelay` rather than `retry`: the hook sets its own retry rule, which a client
    // default cannot switch off. This keeps the one retry it allows instant.
    defaultOptions: { queries: { retry: false, retryDelay: 0 }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={createTheme()}>
        <ToastProvider>
          <ProfilePage />
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
  return queryClient;
}

describe('the profile page', () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = global.fetch as jest.Mock;
    mockFetch.mockReset();
    mockPush.mockReset();
    mockViewer = { username: 'someone-else' };
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

    it('offers Follow and shows the counts, but no tabs and no way into the lists', async () => {
      // It used to show the person alone: the route sent no counts and no follow state for
      // this view, so there was nothing to draw — and following would have unlocked nothing
      // anyway. Now a follow is a request, and this button is the only way in.
      mockFetch.mockResolvedValue(ok(privateProfile));

      renderPage();

      expect(await screen.findByRole('button', { name: 'Follow' })).toBeInTheDocument();
      expect(screen.getByText(LOCK_INVITE)).toBeInTheDocument();
      expect(await findStat('4 recipes')).toBeInTheDocument();
      expect(await findStat('7 followers')).toBeInTheDocument();
      expect(await findStat('2 following')).toBeInTheDocument();
      // The lists answer 403 to this viewer, exactly like the recipes: the counts say how
      // many, and do not pretend they can be opened.
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
      expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    });
  });

  describe('the counts', () => {
    it('open the people lists where the content is visible', async () => {
      mockFetch.mockResolvedValue(ok(publicProfile()));

      renderPage();

      // Real links: the clickable paragraphs they replace could not be reached by keyboard.
      expect(await screen.findByRole('link', { name: '7 followers' })).toHaveAttribute(
        'href',
        '/profile/ana/followers'
      );
      expect(screen.getByRole('link', { name: '2 following' })).toHaveAttribute(
        'href',
        '/profile/ana/following'
      );
      // Not the recipe count: it has no list of its own, the grid below it is the list.
      expect(screen.queryByRole('link', { name: '1 recipe' })).not.toBeInTheDocument();
    });
  });

  describe('following a private account', () => {
    /**
     * The profile route as it stands right now — a test moves `route.profile` on to what a
     * refetch should find — and both follow routes, answered when the test says so.
     */
    function serve(profile: unknown) {
      const reply = later();
      const route = { profile };
      mockFetch.mockImplementation((url: string) =>
        url.endsWith('/follow') || url.endsWith('/unfollow')
          ? reply.promise
          : Promise.resolve(ok(route.profile))
      );
      return { route, reply };
    }

    /** Every POST sent, in order, as its URL. */
    const posts = () =>
      mockFetch.mock.calls
        .filter(([, init]) => (init as RequestInit | undefined)?.method === 'POST')
        .map(([url]) => url);

    /** How many times the profile itself was fetched. */
    const profileLoads = () =>
      mockFetch.mock.calls.filter(([url]) => String(url).endsWith('/profile')).length;

    it('sends a request: "Requested" at once, the count stays, and the lock says what next', async () => {
      const { reply } = serve(lockedProfile('none'));

      const queryClient = renderPage();
      fireEvent.click(await screen.findByRole('button', { name: 'Follow' }));

      // Before the server answers. A request is not a follower, so 7 stays 7 — the old
      // header would have painted "Following" and 8 here.
      expect(await screen.findByRole('button', { name: 'Requested' })).toBeInTheDocument();
      expect(screen.getByText(LOCK_WAITING)).toBeInTheDocument();
      expect(await findStat('7 followers')).toBeInTheDocument();
      expect(posts()).toEqual(['/api/users/ana/follow']);

      reply.answer(ok({ success: true, state: 'requested', followersCount: 7 }));
      await waitFor(() => expect(queryClient.isMutating()).toBe(0));

      // Settled where it was painted, and still locked: a pending request opens nothing,
      // so there was nothing to load again.
      expect(screen.getByRole('button', { name: 'Requested' })).toBeInTheDocument();
      expect(screen.getByText('This profile is private')).toBeInTheDocument();
      expect(profileLoads()).toBe(1);
    });

    it('takes a request back when "Requested" is tapped, without asking', async () => {
      const { reply } = serve(lockedProfile('requested'));

      renderPage();
      expect(await screen.findByText(LOCK_WAITING)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Requested' }));

      // Cancelling loses nothing, so nothing is asked.
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(await screen.findByRole('button', { name: 'Follow' })).toBeInTheDocument();
      expect(screen.getByText(LOCK_INVITE)).toBeInTheDocument();
      expect(posts()).toEqual(['/api/users/ana/unfollow']);

      reply.answer(ok({ success: true, state: 'none', was: 'requested', followersCount: 7 }));
      expect(await findStat('7 followers')).toBeInTheDocument();
    });

    it('goes back to "Follow" and names the request when the server refuses it', async () => {
      const { reply } = serve(lockedProfile('none'));

      renderPage();
      fireEvent.click(await screen.findByRole('button', { name: 'Follow' }));
      await screen.findByRole('button', { name: 'Requested' });

      reply.answer(fail(500));

      // Not "Failed to follow user": nobody asked to follow, they asked to be let in.
      expect(await screen.findByText('Failed to send the follow request')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Follow' })).toBeInTheDocument();
      expect(screen.getByText(LOCK_INVITE)).toBeInTheDocument();
    });

    it('keeps the request, and says so, when a cancel has no connection', async () => {
      const { reply } = serve(lockedProfile('requested'));

      renderPage();
      fireEvent.click(await screen.findByRole('button', { name: 'Requested' }));
      await screen.findByRole('button', { name: 'Follow' });

      reply.drop();

      expect(
        await screen.findByText('No connection — your request is still pending')
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Requested' })).toBeInTheDocument();
      expect(screen.getByText(LOCK_WAITING)).toBeInTheDocument();
    });

    it('sends a signed-out reader to sign in from the locked view too', async () => {
      mockViewer = null;
      // Signed out, the route says nothing about where the reader stands.
      mockFetch.mockResolvedValue(ok(lockedProfile(null)));

      renderPage();
      expect(await screen.findByText(LOCK_INVITE)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Follow' }));

      expect(mockPush).toHaveBeenCalledWith('/auth');
      expect(posts()).toEqual([]);
    });

    it('shows an accepted follower the recipes, the lists and "Following"', async () => {
      mockFetch.mockResolvedValue(ok(followerView()));

      renderPage();

      expect(await screen.findByText('Receta r1')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Following' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: '7 followers' })).toBeInTheDocument();
      expect(screen.queryByText('This profile is private')).not.toBeInTheDocument();
    });

    it('asks before unfollowing, and puts the lock back once it is done', async () => {
      const { route, reply } = serve(followerView());

      renderPage();
      fireEvent.click(await screen.findByRole('button', { name: 'Following' }));

      // Getting back in is a request the owner has to accept, not one more tap: said first.
      const dialog = await screen.findByRole('dialog', { name: 'Unfollow ana?' });
      expect(
        within(dialog).getByText(
          "This account is private: to see their recipes again you'll have to send another request."
        )
      ).toBeInTheDocument();
      expect(posts()).toEqual([]);

      route.profile = lockedProfile('none');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Unfollow' }));

      expect(await screen.findByRole('button', { name: 'Follow' })).toBeInTheDocument();
      expect(await findStat('6 followers')).toBeInTheDocument();
      expect(posts()).toEqual(['/api/users/ana/unfollow']);

      reply.answer(ok({ success: true, state: 'none', was: 'following', followersCount: 6 }));

      // The profile is loaded again and comes back locked: the recipes go, and the counts
      // stop being ways in.
      expect(await screen.findByText('This profile is private')).toBeInTheDocument();
      expect(screen.queryByText('Receta r1')).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /followers/ })).not.toBeInTheDocument();
      expect(profileLoads()).toBe(2);
    });

    it('sends nothing when the unfollow is called off', async () => {
      serve(followerView());

      renderPage();
      fireEvent.click(await screen.findByRole('button', { name: 'Following' }));
      const dialog = await screen.findByRole('dialog', { name: 'Unfollow ana?' });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(screen.getByRole('button', { name: 'Following' })).toBeInTheDocument();
      expect(screen.getByText('Receta r1')).toBeInTheDocument();
      expect(posts()).toEqual([]);
    });

    it('takes the server’s word over the paint: a request answered with a follow opens the profile', async () => {
      // The account went public between the page load and the tap, so the server followed
      // instead of asking. Painting "Requested" and stopping there would leave a follower
      // staring at a lock.
      const { route, reply } = serve(lockedProfile('none'));

      renderPage();
      fireEvent.click(await screen.findByRole('button', { name: 'Follow' }));
      await screen.findByRole('button', { name: 'Requested' });

      route.profile = publicProfile({
        stats: { recipesCount: 1, followersCount: 8, followingCount: 2 },
        followState: 'following',
        isFollowing: true,
      });
      reply.answer(ok({ success: true, state: 'following', followersCount: 8 }));

      expect(await screen.findByText('Receta r1')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Following' })).toBeInTheDocument();
      expect(await findStat('8 followers')).toBeInTheDocument();
      expect(screen.queryByText('This profile is private')).not.toBeInTheDocument();
    });

    it('takes the server’s word the other way too: a follow answered with a request locks it', async () => {
      // The account went private mid-tap. The paint said "Following" and 8; the server
      // says a request is waiting and the count never moved.
      const { route, reply } = serve(publicProfile());

      renderPage();
      fireEvent.click(await screen.findByRole('button', { name: 'Follow' }));
      expect(await findStat('8 followers')).toBeInTheDocument();

      route.profile = lockedProfile('requested');
      reply.answer(ok({ success: true, state: 'requested', followersCount: 7 }));

      expect(await screen.findByText(LOCK_WAITING)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Requested' })).toBeInTheDocument();
      expect(await findStat('7 followers')).toBeInTheDocument();
      expect(screen.queryByText('Receta r1')).not.toBeInTheDocument();
    });
  });

  describe('your own profile', () => {
    it('has Edit Profile, and no follow button', async () => {
      mockViewer = { username: 'ana' };
      mockFetch.mockResolvedValue(ok(publicProfile({ isFollowing: undefined })));

      renderPage();

      expect(await screen.findByRole('button', { name: 'Edit Profile' })).toBeInTheDocument();
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
