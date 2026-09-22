import { act, renderHook, waitFor } from '@testing-library/react';
import { queryWrapper, testQueryClient } from '@/__tests__/helpers/queryClient';
import { queryKeys } from '@/lib/query/keys';
import { useFollowProfile } from '../useFollowProfile';
import { useProfile, type Profile } from '../useProfile';
import type { QueryClient } from '@tanstack/react-query';

/**
 * Following from a profile header: each tap paints at once, the server's answer settles it,
 * a failure takes back the two follow fields and says so, and an answer that changes what
 * the viewer may see of a private account tells every cache that showed its recipes.
 *
 * The page's own suite (app/profile/__tests__/profilePage.test.tsx) covers what is SEEN of
 * this; here is what only the cache shows — the order requests leave in, and what gets
 * forgotten.
 */

let mockViewer: { id: string; username: string } | null = { id: 'v1', username: 'vera' };
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockViewer, isAuthenticated: mockViewer !== null }),
}));

const mockShowError = jest.fn();
jest.mock('@/contexts/ToastContext', () => ({
  useToast: () => ({
    showError: mockShowError,
    showInfo: jest.fn(),
    showSuccess: jest.fn(),
    showWarning: jest.fn(),
    showToast: jest.fn(),
  }),
}));

const KEY = queryKeys.profile('ana');
const FEED = queryKeys.feed({ difficulty: '', time: '', sort: '' });

const viewerState = (liked: boolean) => ({
  liked,
  saved: false,
  timesCooked: 0,
  lastCookedAt: null,
  myRating: null,
});

const recipe = {
  id: 'r1',
  title: 'Receta',
  description: null,
  imageUrl: '/r.jpg',
  difficulty: 'easy',
  prepTime: null,
  cookingTime: null,
  servings: null,
  likeCount: 3,
  commentCount: 0,
  viewer: viewerState(false),
};

const stats = { recipesCount: 1, followersCount: 7, followingCount: 2 };

/** The full view: a public account, or a private one the viewer follows. */
const full = (isPrivate: boolean, followState: Profile['followState'], followersCount = 7) =>
  ({
    visibility: 'public',
    user: { id: 'u1', username: 'ana', isPrivate },
    stats: { ...stats, followersCount },
    recipes: [recipe],
    savedRecipes: [],
    followState,
  }) satisfies Profile;

/** The locked view of a private account. */
const locked = (followState: Profile['followState']) =>
  ({
    visibility: 'private',
    user: { id: 'u1', username: 'ana', isPrivate: true },
    stats,
    followState,
  }) satisfies Profile;

type Answer = { ok: boolean; status: number; json: () => Promise<unknown> };
const ok = (body: unknown): Answer => ({ ok: true, status: 200, json: async () => body });
const refused = (status: number, body: unknown): Answer => ({
  ok: false,
  status,
  json: async () => body,
});

/** An answer the test hands over when it chooses to. */
function later() {
  let answer: (value: Answer) => void = () => {};
  let drop: () => void = () => {};
  const promise = new Promise<Answer>((resolve, reject) => {
    answer = resolve;
    drop = () => reject(new TypeError('Failed to fetch'));
  });
  return { promise, answer, drop };
}

function setup(profile: Profile) {
  const client = testQueryClient();
  client.setQueryData(KEY, profile);
  // Something from every other cache a follow can make wrong.
  client.setQueryData(FEED, { pages: [], pageParams: [] });
  client.setQueryData(queryKeys.recipe('r1'), { recipe: { id: 'r1' } });
  client.setQueryData(queryKeys.profile('vera'), full(false, null));

  const { result } = renderHook(() => useFollowProfile('ana'), {
    wrapper: queryWrapper(client),
  });
  return { client, act: result.current.act };
}

const follow = (client: QueryClient) => {
  const profile = client.getQueryData<Profile>(KEY);
  return { state: profile?.followState, count: profile?.stats.followersCount };
};

const stale = (client: QueryClient, key: readonly unknown[]) =>
  client.getQueryState(key)?.isInvalidated;

/** Every POST the hook sent, in order, as the path after /api/users/. */
const posts = (mockFetch: jest.Mock) =>
  mockFetch.mock.calls
    .filter(([, init]) => (init as RequestInit | undefined)?.method === 'POST')
    .map(([url]) => String(url).replace('/api/users/', ''));

describe('useFollowProfile', () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = global.fetch as jest.Mock;
    mockFetch.mockReset();
    mockShowError.mockReset();
    mockViewer = { id: 'v1', username: 'vera' };
  });

  describe('each tap paints at once, then takes the server’s answer', () => {
    it('follow: a public account is followed, and gains a follower', async () => {
      const pending = later();
      mockFetch.mockReturnValue(pending.promise);
      const { client, act: tap } = setup(full(false, 'none'));

      act(() => tap('follow'));

      await waitFor(() => expect(follow(client)).toEqual({ state: 'following', count: 8 }));
      expect(posts(mockFetch)).toEqual(['ana/follow']);

      // Someone else followed in the meantime: the guess was 8, the truth is 9.
      await act(async () => pending.answer(ok({ state: 'following', followersCount: 9 })));
      expect(follow(client)).toEqual({ state: 'following', count: 9 });
    });

    it('request: a private account gets a request, and the count does not move', async () => {
      const pending = later();
      mockFetch.mockReturnValue(pending.promise);
      const { client, act: tap } = setup(locked('none'));

      act(() => tap('request'));

      await waitFor(() => expect(follow(client)).toEqual({ state: 'requested', count: 7 }));
      expect(posts(mockFetch)).toEqual(['ana/follow']);

      await act(async () => pending.answer(ok({ state: 'requested', followersCount: 7 })));
      expect(follow(client)).toEqual({ state: 'requested', count: 7 });
    });

    it('cancel: the request is taken back, and the count does not move', async () => {
      const pending = later();
      mockFetch.mockReturnValue(pending.promise);
      const { client, act: tap } = setup(locked('requested'));

      act(() => tap('cancel'));

      await waitFor(() => expect(follow(client)).toEqual({ state: 'none', count: 7 }));
      expect(posts(mockFetch)).toEqual(['ana/unfollow']);

      await act(async () =>
        pending.answer(ok({ state: 'none', was: 'requested', followersCount: 7 }))
      );
      expect(follow(client)).toEqual({ state: 'none', count: 7 });
    });

    it('unfollow: a public account loses a follower', async () => {
      const pending = later();
      mockFetch.mockReturnValue(pending.promise);
      const { client, act: tap } = setup(full(false, 'following', 8));

      act(() => tap('unfollow'));

      await waitFor(() => expect(follow(client)).toEqual({ state: 'none', count: 7 }));
      expect(posts(mockFetch)).toEqual(['ana/unfollow']);

      await act(async () =>
        pending.answer(ok({ state: 'none', was: 'following', followersCount: 6 }))
      );
      expect(follow(client)).toEqual({ state: 'none', count: 6 });
    });
  });

  describe("when the server's answer differs from the guess", () => {
    it('shows "Solicitado" for an account that went private, and relocks what it showed', async () => {
      mockFetch.mockResolvedValue(ok({ state: 'requested', followersCount: 7 }));
      const { client, act: tap } = setup(full(false, 'none'));

      act(() => tap('follow'));

      await waitFor(() => expect(follow(client)).toEqual({ state: 'requested', count: 7 }));
      // It was on screen as a public profile with its recipes; they are no longer the
      // viewer's to see.
      expect(stale(client, KEY)).toBe(true);
      expect(stale(client, FEED)).toBe(true);
      expect(client.getQueryData(queryKeys.recipe('r1'))).toBeUndefined();
    });

    it('opens a locked profile whose request came back as a follow', async () => {
      // Already a follower from before the account went private, or it went public.
      mockFetch.mockResolvedValue(ok({ state: 'following', followersCount: 8 }));
      const { client, act: tap } = setup(locked('none'));

      act(() => tap('request'));

      await waitFor(() => expect(follow(client)).toEqual({ state: 'following', count: 8 }));
      expect(stale(client, KEY)).toBe(true);
      expect(stale(client, FEED)).toBe(true);
      expect(client.getQueryData(queryKeys.recipe('r1'))).toBeDefined();
    });

    it('treats a cancel that removed an accepted follow as the loss it was', async () => {
      // The owner tapped "Aceptar" while the reader was looking at "Solicitado".
      mockFetch.mockResolvedValue(ok({ state: 'none', was: 'following', followersCount: 6 }));
      const { client, act: tap } = setup(locked('requested'));

      act(() => tap('cancel'));

      await waitFor(() => expect(follow(client)).toEqual({ state: 'none', count: 6 }));
      expect(stale(client, FEED)).toBe(true);
      expect(client.getQueryData(queryKeys.recipe('r1'))).toBeUndefined();
    });
  });

  describe('when access to a private account changes', () => {
    it('refetches the profile on screen, so the lock goes back on', async () => {
      // What the route sends, before and after: the full view of a private account the
      // viewer follows, then its locked view.
      const user = { id: 'u1', username: 'ana', isPrivate: true };
      let profileAnswer: unknown = {
        user,
        stats: { ...stats, followersCount: 8 },
        recipes: [recipe],
        isOwnProfile: false,
        followState: 'following',
      };
      mockFetch.mockImplementation((_url: string, init?: RequestInit) =>
        Promise.resolve(
          init?.method === 'POST'
            ? ok({ state: 'none', was: 'following', followersCount: 7 })
            : ok(profileAnswer)
        )
      );
      const client = testQueryClient();
      const { result } = renderHook(
        () => ({ profile: useProfile('ana'), follow: useFollowProfile('ana') }),
        { wrapper: queryWrapper(client) }
      );
      await waitFor(() => expect(result.current.profile.data?.visibility).toBe('public'));

      profileAnswer = {
        user,
        stats,
        recipes: [],
        isOwnProfile: false,
        isPrivateProfile: true,
        followState: 'none',
      };
      act(() => result.current.follow.act('unfollow'));

      await waitFor(() => expect(result.current.profile.data?.visibility).toBe('private'));
      const gets = mockFetch.mock.calls.filter(([, init]) => init?.method !== 'POST');
      expect(gets).toHaveLength(2);
    });

    it.each([
      ['is answered', ok({ state: 'requested', followersCount: 7 }), 'requested'],
      // Settled by the failure instead of an answer: the relock is owed all the same.
      ['fails', null, 'none'],
    ] as const)(
      'still relocks when the tap that cut the relock short %s',
      async (_, answer, state) => {
        // Unfollow a private account, then tap "Seguir" before the locked view arrives. The
        // tap cancels the refetch so it cannot land on the new paint, and the request's own
        // answer changes no access — the viewer was already out. Nothing else would send the
        // refetch again, and the recipes the unfollow took away would stay on screen.
        const user = { id: 'u1', username: 'ana', isPrivate: true };
        const relock = later();
        const lockedAnswer = {
          user,
          stats,
          recipes: [],
          isOwnProfile: false,
          isPrivateProfile: true,
          followState: state,
        };
        const profileAnswers = [
          Promise.resolve(
            ok({
              user,
              stats: { ...stats, followersCount: 8 },
              recipes: [recipe],
              isOwnProfile: false,
              followState: 'following',
            })
          ),
          relock.promise,
          Promise.resolve(ok(lockedAnswer)),
        ];
        mockFetch.mockImplementation((url: string, init?: RequestInit) => {
          if (init?.method !== 'POST') {
            return profileAnswers.shift() ?? Promise.resolve(ok(lockedAnswer));
          }
          if (String(url).endsWith('/unfollow')) {
            return Promise.resolve(ok({ state: 'none', was: 'following', followersCount: 7 }));
          }
          return answer
            ? Promise.resolve(answer)
            : Promise.reject(new TypeError('Failed to fetch'));
        });
        const client = testQueryClient();
        const { result } = renderHook(
          () => ({ profile: useProfile('ana'), follow: useFollowProfile('ana') }),
          { wrapper: queryWrapper(client) }
        );
        await waitFor(() => expect(result.current.profile.data?.visibility).toBe('public'));
        const gets = () => mockFetch.mock.calls.filter(([, init]) => init?.method !== 'POST');

        act(() => result.current.follow.act('unfollow'));
        // The unfollow is answered and the relock is on its way — and held there.
        await waitFor(() => expect(gets()).toHaveLength(2));
        expect(client.isFetching({ queryKey: KEY })).toBe(1);

        act(() => result.current.follow.act('request'));

        await waitFor(() => expect(result.current.profile.data?.visibility).toBe('private'));
        expect(result.current.profile.data?.followState).toBe(state);
        expect(posts(mockFetch)).toEqual(['ana/unfollow', 'ana/follow']);
        expect(gets()).toHaveLength(3);
      }
    );

    it('unfollowing one marks every recipe list stale and drops the recipe pages', async () => {
      mockFetch.mockResolvedValue(ok({ state: 'none', was: 'following', followersCount: 7 }));
      const { client, act: tap } = setup(full(true, 'following', 8));

      act(() => tap('unfollow'));

      await waitFor(() => expect(client.getQueryData(queryKeys.recipe('r1'))).toBeUndefined());
      expect(stale(client, FEED)).toBe(true);
      expect(stale(client, KEY)).toBe(true);
      // The viewer's own "siguiendo" count moved too.
      expect(stale(client, queryKeys.profile('vera'))).toBe(true);
    });

    it('a request that is only pending forgets nothing', async () => {
      mockFetch.mockResolvedValue(ok({ state: 'requested', followersCount: 7 }));
      const { client, act: tap } = setup(locked('none'));

      act(() => tap('request'));

      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
      await act(async () => {});
      expect(stale(client, KEY)).toBe(false);
      expect(stale(client, FEED)).toBe(false);
      expect(stale(client, queryKeys.profile('vera'))).toBe(false);
      expect(client.getQueryData(queryKeys.recipe('r1'))).toBeDefined();
    });

    it('following a public account leaves the lists alone', async () => {
      mockFetch.mockResolvedValue(ok({ state: 'following', followersCount: 8 }));
      const { client, act: tap } = setup(full(false, 'none'));

      act(() => tap('follow'));

      await waitFor(() => expect(follow(client)).toEqual({ state: 'following', count: 8 }));
      expect(stale(client, FEED)).toBe(false);
      expect(client.getQueryData(queryKeys.recipe('r1'))).toBeDefined();
      // Only the viewer's own following count is out of date; the profile holds the answer.
      expect(stale(client, queryKeys.profile('vera'))).toBe(true);
    });
  });

  describe('a failure takes the follow back and says so', () => {
    it.each([
      ['follow', full(false, 'none'), "No connection — you're not following them"],
      ['request', locked('none'), 'No connection — your request was not sent'],
      ['cancel', locked('requested'), 'No connection — your request is still pending'],
      ['unfollow', full(false, 'following', 8), "No connection — you're still following them"],
    ] as const)('%s, offline', async (action, profile, sentence) => {
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));
      const { client, act: tap } = setup(profile);

      act(() => tap(action));

      await waitFor(() => expect(mockShowError).toHaveBeenCalledWith(sentence));
      expect(follow(client)).toEqual({
        state: profile.followState,
        count: profile.stats.followersCount,
      });
    });

    it.each([
      ['follow', full(false, 'none'), 'user.followFailed', 'Failed to follow user'],
      ['request', locked('none'), 'user.followFailed', 'Failed to send the follow request'],
      ['cancel', locked('requested'), 'user.unfollowFailed', 'Failed to cancel the follow request'],
      ['unfollow', full(false, 'following', 8), 'user.unfollowFailed', 'Failed to unfollow user'],
    ] as const)('%s, refused', async (action, profile, code, sentence) => {
      mockFetch.mockResolvedValue(refused(500, { error: 'Failed', code }));
      const { client, act: tap } = setup(profile);

      act(() => tap(action));

      await waitFor(() => expect(mockShowError).toHaveBeenCalledWith(sentence));
      expect(follow(client)).toEqual({
        state: profile.followState,
        count: profile.stats.followersCount,
      });
    });

    it('lets a specific refusal speak for itself', async () => {
      mockFetch.mockResolvedValue(refused(401, { error: 'Unauthorized', code: 'unauthorized' }));
      const { act: tap } = setup(full(false, 'none'));

      act(() => tap('follow'));

      await waitFor(() =>
        expect(mockShowError).toHaveBeenCalledWith('You need to log in to do that.')
      );
    });

    it('puts back only the follow fields, not a heart tapped meanwhile', async () => {
      const pending = later();
      mockFetch.mockReturnValue(pending.promise);
      const { client, act: tap } = setup(full(false, 'none'));

      act(() => tap('follow'));
      await waitFor(() => expect(follow(client).state).toBe('following'));

      // A heart on one of the profile's cards, while the follow is in flight.
      client.setQueryData<Profile>(KEY, (profile) =>
        profile?.visibility === 'public'
          ? { ...profile, recipes: [{ ...recipe, likeCount: 4, viewer: viewerState(true) }] }
          : profile
      );

      await act(async () => pending.answer(refused(500, { code: 'user.followFailed' })));

      const after = client.getQueryData<Profile>(KEY);
      expect(follow(client)).toEqual({ state: 'none', count: 7 });
      expect(after?.visibility === 'public' && after.recipes[0].viewer?.liked).toBe(true);
    });

    it('forgets nothing when the follow failed', async () => {
      mockFetch.mockResolvedValue(refused(500, { code: 'user.unfollowFailed' }));
      const { client, act: tap } = setup(full(true, 'following', 8));

      act(() => tap('unfollow'));

      await waitFor(() => expect(mockShowError).toHaveBeenCalled());
      expect(stale(client, FEED)).toBe(false);
      expect(client.getQueryData(queryKeys.recipe('r1'))).toBeDefined();
    });
  });

  describe('rapid taps', () => {
    it('reach the server one at a time, in the order they were tapped', async () => {
      const first = later();
      const second = later();
      mockFetch.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
      const { client, act: tap } = setup(full(false, 'none'));

      act(() => tap('follow'));
      await waitFor(() => expect(follow(client).state).toBe('following'));
      act(() => tap('unfollow'));

      // The second tap painted at once; its request waits for the first to be answered.
      await waitFor(() => expect(follow(client)).toEqual({ state: 'none', count: 7 }));
      expect(posts(mockFetch)).toEqual(['ana/follow']);

      await act(async () => first.answer(ok({ state: 'following', followersCount: 8 })));
      await waitFor(() => expect(posts(mockFetch)).toEqual(['ana/follow', 'ana/unfollow']));
      // The first answer did not repaint "Siguiendo" over the reader's last tap.
      expect(follow(client)).toEqual({ state: 'none', count: 7 });

      await act(async () =>
        second.answer(ok({ state: 'none', was: 'following', followersCount: 7 }))
      );
      expect(follow(client)).toEqual({ state: 'none', count: 7 });
      expect(mockShowError).not.toHaveBeenCalled();
    });

    it("go back to the server's last word when the last one fails", async () => {
      const first = later();
      const second = later();
      mockFetch.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
      const { client, act: tap } = setup(full(false, 'none'));

      act(() => tap('follow'));
      await waitFor(() => expect(follow(client).state).toBe('following'));
      act(() => tap('unfollow'));
      await waitFor(() => expect(follow(client).state).toBe('none'));

      await act(async () => first.answer(ok({ state: 'following', followersCount: 9 })));
      await waitFor(() => expect(posts(mockFetch)).toHaveLength(2));
      await act(async () => second.drop());

      // Not to 'none' and 7, as before the burst: the follow went through.
      await waitFor(() => expect(follow(client)).toEqual({ state: 'following', count: 9 }));
      expect(mockShowError).toHaveBeenCalledWith("No connection — you're still following them");
    });

    it('go back to where they started, quietly, when the reader ended where they began', async () => {
      const first = later();
      const second = later();
      mockFetch.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
      const { client, act: tap } = setup(full(false, 'none'));

      act(() => tap('follow'));
      await waitFor(() => expect(follow(client).state).toBe('following'));
      act(() => tap('unfollow'));
      await waitFor(() => expect(follow(client).state).toBe('none'));

      await act(async () => first.drop());
      await waitFor(() => expect(posts(mockFetch)).toHaveLength(2));
      // The earlier failure did not undo the later tap's paint.
      expect(follow(client)).toEqual({ state: 'none', count: 7 });

      await act(async () => second.drop());
      await waitFor(() => expect(follow(client)).toEqual({ state: 'none', count: 7 }));
      // Not following, which is what the last tap asked for: nothing to take back or report.
      expect(mockShowError).not.toHaveBeenCalled();
    });

    it('settle on the later answer when the earlier one failed', async () => {
      const first = later();
      const second = later();
      mockFetch
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise)
        .mockResolvedValueOnce(ok({ state: 'requested', followersCount: 7 }));
      const { client, act: tap } = setup(locked('none'));

      // Request, cancel, request again — three taps before anything answers.
      act(() => tap('request'));
      await waitFor(() => expect(follow(client).state).toBe('requested'));
      act(() => tap('cancel'));
      await waitFor(() => expect(follow(client).state).toBe('none'));
      act(() => tap('request'));
      await waitFor(() => expect(follow(client).state).toBe('requested'));

      await act(async () => first.drop());
      await waitFor(() => expect(posts(mockFetch)).toHaveLength(2));
      await act(async () => second.answer(ok({ state: 'none', was: 'none', followersCount: 7 })));

      await waitFor(() => expect(posts(mockFetch)).toHaveLength(3));
      await waitFor(() => expect(follow(client)).toEqual({ state: 'requested', count: 7 }));
      expect(posts(mockFetch)).toEqual(['ana/follow', 'ana/unfollow', 'ana/follow']);
      // Only the first failed, and the reader is where the last tap put them.
      expect(mockShowError).not.toHaveBeenCalled();
    });
  });
});
