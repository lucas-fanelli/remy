import { renderHook, waitFor } from '@testing-library/react';
import { queryWrapper, testQueryClient } from '@/__tests__/helpers/queryClient';
import { ProfileFetchError, useProfile } from '../useProfile';

/**
 * What the profile route's two answers become in the cache. The follow button reads
 * `followState` and `user.isPrivate` off either shape, and the locked header shows the
 * counts, so both shapes must carry them.
 */

const stats = { recipesCount: 4, followersCount: 7, followingCount: 2 };
const person = { id: 'u1', username: 'ana', fullName: 'Ana', avatar: null, bio: null };

/** The route's locked branch, as it sends it. */
const lockedAnswer = (over: Record<string, unknown> = {}) => ({
  user: { ...person, isPrivate: true },
  stats,
  recipes: [],
  isOwnProfile: false,
  isPrivateProfile: true,
  followState: 'requested',
  ...over,
});

/** The route's full branch, as it sends it. */
const fullAnswer = (over: Record<string, unknown> = {}) => ({
  user: { ...person, website: null, createdAt: '2026-01-01', isPrivate: true },
  stats,
  recipes: [],
  isOwnProfile: false,
  followState: 'following',
  isFollowing: true,
  ...over,
});

function load(body: unknown, status = 200) {
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: status < 400,
    status,
    json: async () => body,
  });
  const client = testQueryClient();
  // The hook sets its own retry rule, which a client default cannot switch off; this keeps
  // the one retry it allows instant.
  client.setDefaultOptions({ queries: { retry: false, retryDelay: 0 } });
  const { result } = renderHook(() => useProfile('ana'), { wrapper: queryWrapper(client) });
  return result;
}

describe('useProfile', () => {
  beforeEach(() => (global.fetch as jest.Mock).mockReset());

  it('keeps the counts and where the viewer stands on a locked profile', async () => {
    const result = load(lockedAnswer());

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual({
      visibility: 'private',
      user: { ...person, isPrivate: true },
      stats,
      followState: 'requested',
    });
  });

  it('says where the viewer stands on a full profile, and that the account is private', async () => {
    const result = load(fullAnswer());

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toMatchObject({
      visibility: 'public',
      user: { username: 'ana', isPrivate: true },
      stats,
      followState: 'following',
    });
  });

  it('has no follow state for a signed-out reader or on your own profile', async () => {
    const result = load(fullAnswer({ followState: null, isFollowing: undefined }));

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.followState).toBeNull();
  });

  it('reads an answer from before followState through isFollowing', async () => {
    const result = load(
      fullAnswer({ followState: undefined, isFollowing: false, user: { ...person } })
    );

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.followState).toBe('none');
    // No isPrivate at all reads as a public account: that is what the full view was then.
    expect(result.current.data?.user.isPrivate).toBe(false);
  });

  it('fails a locked answer without counts, rather than inventing zeros', async () => {
    const result = load(lockedAnswer({ stats: undefined }));

    await waitFor(() => expect(result.current.error).toBeInstanceOf(ProfileFetchError));
    expect(result.current.data).toBeUndefined();
  });
});
