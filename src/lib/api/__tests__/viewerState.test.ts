import { loadViewerState } from '../viewerState';

type Row = { postId: string; rating?: number };
/** What `groupBy` gives back: one row per post, with the count and the latest date. */
type CookRow = { postId: string; times: number; lastAt: Date };

function makeDb(rows: { likes?: Row[]; saves?: Row[]; cooked?: CookRow[]; ratings?: Row[] }) {
  const findMany = (result: Row[] = []) => jest.fn().mockResolvedValue(result);
  return {
    like: { findMany: findMany(rows.likes) },
    savedRecipe: { findMany: findMany(rows.saves) },
    cookedRecipe: {
      groupBy: jest.fn().mockResolvedValue(
        (rows.cooked ?? []).map((r) => ({
          postId: r.postId,
          _count: { _all: r.times },
          _max: { cookedAt: r.lastAt },
        }))
      ),
    },
    rating: { findMany: findMany(rows.ratings) },
  } as never;
}

const NOTHING_DONE = {
  liked: false,
  saved: false,
  timesCooked: 0,
  lastCookedAt: null,
  myRating: null,
};

describe('loadViewerState', () => {
  it('answers null for every post when nobody is signed in', async () => {
    const db = makeDb({});
    const lookup = await loadViewerState(null, ['a', 'b'], db);

    expect(lookup('a')).toBeNull();
    expect(lookup('b')).toBeNull();
  });

  it('asks the database nothing when nobody is signed in', async () => {
    const db = makeDb({}) as unknown as { like: { findMany: jest.Mock } };
    await loadViewerState(null, ['a'], db as never);

    expect(db.like.findMany).not.toHaveBeenCalled();
  });

  it('distinguishes a signed-out reader from one who has done nothing', async () => {
    const signedOut = await loadViewerState(null, ['a'], makeDb({}));
    const signedIn = await loadViewerState('user-1', ['a'], makeDb({}));

    // This is the distinction the old `liked: false` default erased.
    expect(signedOut('a')).toBeNull();
    expect(signedIn('a')).toEqual(NOTHING_DONE);
  });

  it('reports what the viewer did, per post', async () => {
    const cookedOn = new Date('2026-09-19T12:00:00.000Z');
    const db = makeDb({
      likes: [{ postId: 'a' }],
      saves: [{ postId: 'b' }],
      cooked: [{ postId: 'a', times: 3, lastAt: cookedOn }],
      ratings: [{ postId: 'b', rating: 4 }],
    });
    const lookup = await loadViewerState('user-1', ['a', 'b', 'c'], db);

    expect(lookup('a')).toEqual({
      liked: true,
      saved: false,
      timesCooked: 3,
      lastCookedAt: cookedOn.toISOString(),
      myRating: null,
    });
    expect(lookup('b')).toEqual({ ...NOTHING_DONE, saved: true, myRating: 4 });
    expect(lookup('c')).toEqual(NOTHING_DONE);
  });

  it('reads the four tables once each, however many posts there are', async () => {
    const db = makeDb({}) as unknown as Record<string, { findMany: jest.Mock; groupBy: jest.Mock }>;
    const manyIds = Array.from({ length: 50 }, (_, i) => `post-${i}`);
    await loadViewerState('user-1', manyIds, db as never);

    // The reason this is a batch and not a probe per card.
    for (const table of ['like', 'savedRecipe', 'rating']) {
      expect(db[table].findMany).toHaveBeenCalledTimes(1);
    }
    expect(db.cookedRecipe.groupBy).toHaveBeenCalledTimes(1);
  });

  it('de-duplicates post ids before querying', async () => {
    const db = makeDb({}) as unknown as { like: { findMany: jest.Mock } };
    await loadViewerState('user-1', ['a', 'a', 'b'], db as never);

    expect(db.like.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1', postId: { in: ['a', 'b'] } } })
    );
  });

  it('ignores cooked entries that were soft-deleted', async () => {
    const db = makeDb({}) as unknown as { cookedRecipe: { groupBy: jest.Mock } };
    await loadViewerState('user-1', ['a'], db as never);

    expect(db.cookedRecipe.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
      })
    );
  });

  it('queries nothing for an empty list but still reports a signed-in viewer', async () => {
    const db = makeDb({}) as unknown as { like: { findMany: jest.Mock } };
    const lookup = await loadViewerState('user-1', [], db as never);

    expect(db.like.findMany).not.toHaveBeenCalled();
    expect(lookup('anything')).toEqual(NOTHING_DONE);
  });
});
