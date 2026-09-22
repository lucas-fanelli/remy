import { testQueryClient } from '@/__tests__/helpers/queryClient';
import { queryKeys } from '@/lib/query/keys';
import {
  FollowActionError,
  accessChangeOf,
  afterFollowChange,
  followActionFor,
  followScope,
  followersDelta,
  guessFollowState,
  isFollowState,
  mergeAccessChanges,
  sendFollowAction,
  type FollowResult,
} from '../followAction';

/**
 * The client half of a follow, without React: what a tap means, what it sends, and what the
 * answer makes the cache forget. The hook and the list pages are thin over this, so the
 * rules are pinned here once.
 */

const result = (over: Partial<FollowResult> = {}): FollowResult => ({
  state: 'none',
  was: null,
  followersCount: 7,
  ...over,
});

describe('what a tap on the button means', () => {
  it.each([
    ['none', false, 'follow'],
    ['none', true, 'request'],
    ['requested', true, 'cancel'],
    ['following', false, 'unfollow'],
    ['following', true, 'unfollow'],
  ] as const)('%s on a private=%s account is %s', (state, isPrivate, action) => {
    expect(followActionFor(state, isPrivate)).toBe(action);
  });

  it.each([
    ['follow', 'following'],
    ['request', 'requested'],
    ['cancel', 'none'],
    ['unfollow', 'none'],
  ] as const)('paints %s as %s before the server answers', (action, state) => {
    expect(guessFollowState(action)).toBe(state);
  });

  it('counts a follower only for following, never for a request', () => {
    expect(followersDelta('none', 'following')).toBe(1);
    expect(followersDelta('following', 'none')).toBe(-1);
    expect(followersDelta('none', 'requested')).toBe(0);
    expect(followersDelta('requested', 'none')).toBe(0);
    expect(followersDelta('requested', 'following')).toBe(1);
    expect(followersDelta('following', 'following')).toBe(0);
  });

  it('knows the three states and nothing else', () => {
    expect(['none', 'requested', 'following'].every(isFollowState)).toBe(true);
    expect([undefined, null, 'pending', true, 1].some(isFollowState)).toBe(false);
  });

  it('gives each account its own queue', () => {
    expect(followScope('ana')).toEqual({ id: 'follow:ana' });
    expect(followScope('ana')).not.toEqual(followScope('bruno'));
  });
});

describe('sending it', () => {
  let mockFetch: jest.Mock;
  const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

  beforeEach(() => {
    mockFetch = global.fetch as jest.Mock;
    mockFetch.mockReset();
  });

  it.each([
    ['follow', '/api/users/ana/follow'],
    ['request', '/api/users/ana/follow'],
    ['cancel', '/api/users/ana/unfollow'],
    ['unfollow', '/api/users/ana/unfollow'],
  ] as const)('sends %s to %s, with the header the CSRF guard asks for', async (action, url) => {
    mockFetch.mockResolvedValue(ok({ state: 'none', was: 'none', followersCount: 0 }));

    await sendFollowAction('ana', action);

    expect(mockFetch).toHaveBeenCalledWith(url, {
      method: 'POST',
      headers: { 'X-Requested-With': 'fetch' },
    });
  });

  it("returns the server's state, not the guess", async () => {
    // The account went private between the page load and the tap.
    mockFetch.mockResolvedValue(ok({ success: true, state: 'requested', followersCount: 7 }));

    await expect(sendFollowAction('ana', 'follow')).resolves.toEqual({
      state: 'requested',
      was: null,
      followersCount: 7,
    });
  });

  it('returns what an unfollow took back', async () => {
    mockFetch.mockResolvedValue(ok({ state: 'none', was: 'following', followersCount: 6 }));

    await expect(sendFollowAction('ana', 'cancel')).resolves.toEqual({
      state: 'none',
      was: 'following',
      followersCount: 6,
    });
  });

  it('keeps the guess, and admits no count, when the answer says neither', async () => {
    mockFetch.mockResolvedValue(ok({ success: true }));

    await expect(sendFollowAction('ana', 'request')).resolves.toEqual({
      state: 'requested',
      was: null,
      followersCount: null,
    });
  });

  it('tells a dropped connection apart from a refusal', async () => {
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));
    const offline = await sendFollowAction('ana', 'follow').catch((error: unknown) => error);

    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Failed to follow user', code: 'user.followFailed' }),
    });
    const refused = await sendFollowAction('ana', 'follow').catch((error: unknown) => error);

    expect(offline).toBeInstanceOf(FollowActionError);
    expect(offline).toMatchObject({ offline: true, body: null });
    expect(refused).toBeInstanceOf(FollowActionError);
    expect(refused).toMatchObject({ offline: false, body: { code: 'user.followFailed' } });
  });
});

describe('what the answer does to access', () => {
  it('gains it when a private account is followed', () => {
    expect(
      accessChangeOf({ isPrivate: true, before: 'none', result: result({ state: 'following' }) })
    ).toBe('gained');
  });

  it('loses it when a private account is unfollowed', () => {
    expect(
      accessChangeOf({ isPrivate: true, before: 'following', result: result({ was: 'following' }) })
    ).toBe('lost');
  });

  it('changes nothing for a request or a cancelled one', () => {
    expect(
      accessChangeOf({ isPrivate: true, before: 'none', result: result({ state: 'requested' }) })
    ).toBeNull();
    expect(
      accessChangeOf({ isPrivate: true, before: 'requested', result: result({ was: 'requested' }) })
    ).toBeNull();
  });

  it('changes nothing on a public account, which everyone can see', () => {
    expect(
      accessChangeOf({ isPrivate: false, before: 'none', result: result({ state: 'following' }) })
    ).toBeNull();
    expect(
      accessChangeOf({
        isPrivate: false,
        before: 'following',
        result: result({ was: 'following' }),
      })
    ).toBeNull();
  });

  it("believes the server's `was` over what the page last read", () => {
    // The owner accepted while the page sat on "Solicitado": the cancel removed a follow.
    expect(
      accessChangeOf({ isPrivate: true, before: 'requested', result: result({ was: 'following' }) })
    ).toBe('lost');
  });

  it('treats a request answer as proof the account is private now', () => {
    // A public profile, fully visible, that went private before the tap reached the server.
    expect(
      accessChangeOf({ isPrivate: false, before: 'none', result: result({ state: 'requested' }) })
    ).toBe('lost');
  });

  it('lets a loss win when two changes are merged', () => {
    expect(mergeAccessChanges(null, null)).toBeNull();
    expect(mergeAccessChanges(null, 'gained')).toBe('gained');
    expect(mergeAccessChanges('gained', null)).toBe('gained');
    expect(mergeAccessChanges('gained', 'lost')).toBe('lost');
    expect(mergeAccessChanges('lost', 'gained')).toBe('lost');
  });
});

describe('what the cache forgets afterwards', () => {
  const feedKey = queryKeys.feed({ difficulty: '', time: '', sort: '' });

  function seeded() {
    const client = testQueryClient();
    client.setQueryData(queryKeys.profile('ana'), { visibility: 'public' });
    client.setQueryData(queryKeys.profile('vera'), { visibility: 'public' });
    client.setQueryData(queryKeys.profile('someone'), { visibility: 'public' });
    client.setQueryData(feedKey, { pages: [], pageParams: [] });
    client.setQueryData(queryKeys.matched(), { readyToCook: [], almostThere: [] });
    client.setQueryData(queryKeys.recipe('r1'), { recipe: { id: 'r1' } });
    client.setQueryData(queryKeys.recipe('r2'), { recipe: { id: 'r2' } });
    return client;
  }

  const stale = (client: ReturnType<typeof testQueryClient>, key: readonly unknown[]) =>
    client.getQueryState(key)?.isInvalidated;

  it('drops every cached recipe page and marks every list stale when access is lost', () => {
    // Unfollowing a private account from ANY screen: the list pages call this too.
    const client = seeded();

    const access = afterFollowChange(client, {
      username: 'ana',
      isPrivate: true,
      before: 'following',
      result: result({ was: 'following', followersCount: 6 }),
      viewer: 'vera',
    });

    expect(access).toBe('lost');
    expect(client.getQueryData(queryKeys.recipe('r1'))).toBeUndefined();
    expect(client.getQueryData(queryKeys.recipe('r2'))).toBeUndefined();
    expect(stale(client, feedKey)).toBe(true);
    expect(stale(client, queryKeys.matched())).toBe(true);
    expect(stale(client, queryKeys.profile('ana'))).toBe(true);
    expect(stale(client, queryKeys.profile('vera'))).toBe(true);
  });

  it('marks the lists stale but keeps the recipe pages when access is gained', () => {
    const client = seeded();

    const access = afterFollowChange(client, {
      username: 'ana',
      isPrivate: true,
      before: 'requested',
      result: result({ state: 'following', followersCount: 8 }),
    });

    expect(access).toBe('gained');
    expect(stale(client, feedKey)).toBe(true);
    expect(stale(client, queryKeys.profile('ana'))).toBe(true);
    expect(client.getQueryData(queryKeys.recipe('r1'))).toEqual({ recipe: { id: 'r1' } });
  });

  it('marks only the two counts stale when a public account is followed', () => {
    const client = seeded();

    const access = afterFollowChange(client, {
      username: 'ana',
      isPrivate: false,
      before: 'none',
      result: result({ state: 'following', followersCount: 8 }),
      viewer: 'vera',
    });

    expect(access).toBeNull();
    expect(stale(client, queryKeys.profile('ana'))).toBe(true);
    expect(stale(client, queryKeys.profile('vera'))).toBe(true);
    expect(stale(client, queryKeys.profile('someone'))).toBe(false);
    expect(stale(client, feedKey)).toBe(false);
    expect(client.getQueryData(queryKeys.recipe('r1'))).toBeDefined();
  });

  it('forgets nothing when a request is sent or taken back', () => {
    const client = seeded();

    afterFollowChange(client, {
      username: 'ana',
      isPrivate: true,
      before: 'none',
      result: result({ state: 'requested' }),
      viewer: 'vera',
    });
    afterFollowChange(client, {
      username: 'ana',
      isPrivate: true,
      before: 'requested',
      result: result({ was: 'requested' }),
      viewer: 'vera',
    });

    expect(stale(client, queryKeys.profile('ana'))).toBe(false);
    expect(stale(client, queryKeys.profile('vera'))).toBe(false);
    expect(stale(client, feedKey)).toBe(false);
    expect(client.getQueryData(queryKeys.recipe('r1'))).toBeDefined();
  });
});
