/**
 * @jest-environment node
 */
import { followStateOf, followStatesFor } from '../state';

const VIEWER = 'viewer-1';

/** `prisma` with the two tables the readers may ask, answering with the rows given. */
function mockDb(
  follows: Array<{ followingId: string }> = [],
  requests: Array<{ targetId: string }> = []
) {
  return {
    follow: { findMany: jest.fn().mockResolvedValue(follows) },
    followRequest: { findMany: jest.fn().mockResolvedValue(requests) },
  };
}

describe('followStatesFor', () => {
  it('answers for every account asked about, with one query per table', async () => {
    const db = mockDb([{ followingId: 'b' }], [{ targetId: 'c' }]);

    const states = await followStatesFor(db as never, VIEWER, ['a', 'b', 'c']);

    expect(Object.fromEntries(states)).toEqual({ a: 'none', b: 'following', c: 'requested' });
    expect(db.follow.findMany).toHaveBeenCalledTimes(1);
    expect(db.followRequest.findMany).toHaveBeenCalledTimes(1);
    expect(db.follow.findMany).toHaveBeenCalledWith({
      where: { followerId: VIEWER, followingId: { in: ['a', 'b', 'c'] } },
      select: { followingId: true },
    });
  });

  it('counts a request only while its target is private, in the query itself', async () => {
    // A request left over from when an account was private must not show "Solicitado" on
    // a public account: nobody would ever be asked to approve it.
    const db = mockDb();

    await followStatesFor(db as never, VIEWER, ['a']);

    expect(db.followRequest.findMany).toHaveBeenCalledWith({
      where: { requesterId: VIEWER, targetId: { in: ['a'] }, target: { isPrivate: true } },
      select: { targetId: true },
    });
  });

  it('lets a follow outrank a request for the same account', async () => {
    // The follow is what grants access; "Siguiendo", whose tap clears both rows.
    const db = mockDb([{ followingId: 'a' }], [{ targetId: 'a' }]);

    const states = await followStatesFor(db as never, VIEWER, ['a']);

    expect(states.get('a')).toBe('following');
  });

  it('asks about each account once, however often it is listed', async () => {
    const db = mockDb();

    const states = await followStatesFor(db as never, VIEWER, ['a', 'a', 'b']);

    expect([...states.keys()]).toEqual(['a', 'b']);
    expect(db.follow.findMany.mock.calls[0][0].where.followingId).toEqual({ in: ['a', 'b'] });
  });

  it('answers none for everyone, without a query, when signed out', async () => {
    const db = mockDb();

    const states = await followStatesFor(db as never, null, ['a', 'b']);

    expect(Object.fromEntries(states)).toEqual({ a: 'none', b: 'none' });
    expect(db.follow.findMany).not.toHaveBeenCalled();
    expect(db.followRequest.findMany).not.toHaveBeenCalled();
  });

  it('asks nothing for an empty list', async () => {
    const db = mockDb();

    await expect(followStatesFor(db as never, VIEWER, [])).resolves.toEqual(new Map());
    expect(db.follow.findMany).not.toHaveBeenCalled();
    expect(db.followRequest.findMany).not.toHaveBeenCalled();
  });
});

describe('followStateOf', () => {
  it.each([
    ['a follow', [{ followingId: 'owner' }], [], 'following'],
    ['a request to a private account', [], [{ targetId: 'owner' }], 'requested'],
    ['neither', [], [], 'none'],
  ])('reads %s as %p', async (_what, follows, requests, expected) => {
    const db = mockDb(follows, requests);

    await expect(followStateOf(db as never, VIEWER, 'owner')).resolves.toBe(expected);
  });

  it('reads a request to a public account as none', async () => {
    // The database answers the filtered query with no row; the reader must have asked with
    // the filter for that to happen.
    const db = mockDb();

    await expect(followStateOf(db as never, VIEWER, 'owner')).resolves.toBe('none');
    expect(db.followRequest.findMany.mock.calls[0][0].where.target).toEqual({ isPrivate: true });
  });

  it('is none for a signed-out viewer, without a query', async () => {
    const db = mockDb();

    await expect(followStateOf(db as never, null, 'owner')).resolves.toBe('none');
    expect(db.follow.findMany).not.toHaveBeenCalled();
  });
});
