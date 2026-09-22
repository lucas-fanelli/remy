import { VIEWER_SPECS, type Engagement } from '../specs';

/**
 * The policy, exercised over the registry rather than per action.
 *
 * Liking and saving were two implementations that agreed on nothing: the feed painted
 * immediately and rolled back, the recipe page waited for the round trip, and both of the
 * recipe page's handlers swallowed an HTTP rejection outright. Everything below iterates
 * `VIEWER_SPECS`, so a third spec cannot be added without being held to the same rules.
 */

const SPECS = Object.values(VIEWER_SPECS);
const specNames = Object.keys(VIEWER_SPECS);

const engagement = (over: Partial<Engagement> = {}): Engagement => ({
  viewer: { liked: false, saved: false, timesCooked: 0, lastCookedAt: null, myRating: null },
  likeCount: 3,
  ...over,
});

describe('every viewer spec', () => {
  it('covers the actions this layer claims to own', () => {
    expect(specNames.sort()).toEqual(['like', 'save']);
  });

  describe.each(SPECS.map((spec) => [spec.key, spec] as const))('%s', (_name, spec) => {
    it('sends the state the reader asked for, never a flip', () => {
      // Intent rather than toggle is what makes a retry, a second tab and any future
      // offline replay land on one answer instead of oscillating.
      expect(spec.body(true)).toEqual(expect.objectContaining({ [`${spec.key}d`]: true }));
      expect(spec.body(false)).toEqual(expect.objectContaining({ [`${spec.key}d`]: false }));
    });

    it('reads its own flag off the cache', () => {
      const on = spec.optimistic(engagement(), true);
      const off = spec.optimistic(engagement(), false);

      expect(spec.read(on)).toBe(true);
      expect(spec.read(off)).toBe(false);
    });

    it('paints the flag without waiting for anything', () => {
      const before = engagement();

      expect(spec.read(before)).toBe(false);
      expect(spec.read(spec.optimistic(before, true))).toBe(true);
    });

    it('does not mutate what it was given', () => {
      // The same object is in a React Query cache; patching it in place would update the
      // screen without React ever hearing about it, and would make the rollback a no-op.
      const before = engagement();
      const snapshot = JSON.parse(JSON.stringify(before));

      spec.optimistic(before, true);

      expect(before).toEqual(snapshot);
    });

    it('invents a viewer rather than crashing when there is none', () => {
      // Only reachable if a signed-in reader holds a recipe fetched while signed out.
      const next = spec.optimistic(engagement({ viewer: null }), true);

      expect(next.viewer).not.toBeNull();
      expect(spec.read(next)).toBe(true);
    });

    it('has a sentence for each of the five things that can happen', () => {
      // `offline` is separate from `failed` on purpose: the reader is owed "and I put it
      // back", not "it broke".
      expect(Object.keys(spec.text).sort()).toEqual([
        'failed',
        'off',
        'offline',
        'on',
        'signedOut',
      ]);
      Object.values(spec.text).forEach((descriptor) => {
        expect(descriptor.key).toMatch(/^recipe\./);
      });
    });
  });
});

describe('the like spec in particular', () => {
  const like = VIEWER_SPECS.like;

  it('moves the count with the flag', () => {
    expect(like.optimistic(engagement({ likeCount: 3 }), true).likeCount).toBe(4);
    expect(
      like.optimistic(
        engagement({
          likeCount: 3,
          viewer: { liked: true, saved: false, timesCooked: 0, lastCookedAt: null, myRating: null },
        }),
        false
      ).likeCount
    ).toBe(2);
  });

  it('never renders a negative count when the flag and the count disagree', () => {
    // Reachable: a recipe liked in another tab arrives with `liked: false` and a count of
    // 1. Unliking it would show -1 for as long as the request is in flight.
    expect(like.optimistic(engagement({ likeCount: 0 }), false).likeCount).toBe(0);
  });

  it('adopts the server count, even when it disagrees with the guess', () => {
    // Someone else liked it while the request was in flight; the server knows and we do not.
    const settled = like.settle(engagement({ likeCount: 4 }), { liked: true, likeCount: 9 });

    expect(settled.likeCount).toBe(9);
    expect(settled.viewer?.liked).toBe(true);
  });
});

describe('the save spec in particular', () => {
  const save = VIEWER_SPECS.save;

  it('leaves the like count alone', () => {
    // Saving and liking share a payload; a save that touched `likeCount` would silently
    // undo a like that was in flight beside it.
    expect(save.optimistic(engagement({ likeCount: 7 }), true).likeCount).toBe(7);
    expect(save.settle(engagement({ likeCount: 7 }), { saved: true }).likeCount).toBe(7);
  });

  it('adopts the server flag', () => {
    expect(save.settle(engagement(), { saved: true }).viewer?.saved).toBe(true);
  });
});
