import { QueryClient } from '@tanstack/react-query';
import { VIEWER_SPECS, type Engagement } from '@/lib/engagement/specs';
import { queryKeys } from '../keys';
import { patchRecipeEverywhere } from '../patchRecipeEverywhere';

/**
 * Patching every cache a recipe sits in, and being able to put all of them back.
 *
 * Liking from the feed used to write the feed's own `useState` and nothing else, so
 * opening that recipe showed the heart as it had been before the click. One registered
 * shape per payload replaces one handler per action per screen.
 */

const recipe = (id: string, over: Partial<Engagement> = {}) => ({
  id,
  title: 'Empanadas',
  viewer: { liked: false, saved: false, timesCooked: 0, lastCookedAt: null, myRating: null },
  likeCount: 3,
  ...over,
});

const like = (next: boolean) => (engagement: Engagement) =>
  VIEWER_SPECS.like.optimistic(engagement, next);

describe('patchRecipeEverywhere', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('patches the detail cache', () => {
    queryClient.setQueryData(queryKeys.recipe('a'), { recipe: recipe('a') });

    patchRecipeEverywhere(queryClient, 'a', like(true));

    const data = queryClient.getQueryData<{
      recipe: { viewer: { liked: boolean }; likeCount: number };
    }>(queryKeys.recipe('a'));
    expect(data?.recipe.viewer.liked).toBe(true);
    expect(data?.recipe.likeCount).toBe(4);
  });

  it('leaves everything else on the recipe untouched', () => {
    // The patcher can reach `viewer` and `likeCount` and nothing else, which is why it
    // cannot corrupt a list while updating a heart.
    queryClient.setQueryData(queryKeys.recipe('a'), { recipe: recipe('a') });

    patchRecipeEverywhere(queryClient, 'a', like(true));

    const data = queryClient.getQueryData<{ recipe: { title: string } }>(queryKeys.recipe('a'));
    expect(data?.recipe.title).toBe('Empanadas');
  });

  it('puts back exactly what was there', () => {
    const before = { recipe: recipe('a', { likeCount: 41 }) };
    queryClient.setQueryData(queryKeys.recipe('a'), before);

    const undo = patchRecipeEverywhere(queryClient, 'a', like(true));
    undo();

    expect(queryClient.getQueryData(queryKeys.recipe('a'))).toEqual(before);
  });

  it('does not touch a different recipe under its own key', () => {
    queryClient.setQueryData(queryKeys.recipe('a'), { recipe: recipe('a') });
    queryClient.setQueryData(queryKeys.recipe('b'), { recipe: recipe('b') });

    patchRecipeEverywhere(queryClient, 'a', like(true));

    const other = queryClient.getQueryData<{ recipe: { viewer: { liked: boolean } } }>(
      queryKeys.recipe('b')
    );
    expect(other?.recipe.viewer.liked).toBe(false);
  });

  it('is a no-op when the recipe is in no cache at all', () => {
    // Liking from a screen whose list is still local state. It has to be harmless rather
    // than throwing, because that is every screen except the detail page right now.
    const undo = patchRecipeEverywhere(queryClient, 'missing', like(true));

    expect(() => undo()).not.toThrow();
  });

  it('writes a new object rather than editing the cached one in place', () => {
    // An in-place edit would update the screen without React hearing about it, and would
    // make the rollback write back an object that had already been mutated.
    const before = { recipe: recipe('a') };
    queryClient.setQueryData(queryKeys.recipe('a'), before);

    patchRecipeEverywhere(queryClient, 'a', like(true));

    expect(before.recipe.viewer.liked).toBe(false);
    expect(queryClient.getQueryData(queryKeys.recipe('a'))).not.toBe(before);
  });

  it('ignores a cache entry that has no data yet', () => {
    // A query that has been declared but never resolved. `undefined` is not a payload and
    // patching it would create one out of nothing.
    queryClient.setQueryData(queryKeys.recipe('a'), undefined);

    const undo = patchRecipeEverywhere(queryClient, 'a', like(true));

    expect(queryClient.getQueryData(queryKeys.recipe('a'))).toBeUndefined();
    expect(() => undo()).not.toThrow();
  });
});

describe('queryKeys', () => {
  it('spells the recipe key the one way the whole app agrees on', () => {
    // It was hand-written in two places and they happened to match. A third speller would
    // have given that screen a cache no mutation reaches, silently.
    expect(queryKeys.recipe('abc')).toEqual(['recipe', 'abc']);
  });

  it('keeps feed filters inside the key so two filter sets cannot share a cache', () => {
    const a = queryKeys.feed({ difficulty: 'easy', time: 'any', sort: 'newest' });
    const b = queryKeys.feed({ difficulty: 'hard', time: 'any', sort: 'newest' });

    expect(a).not.toEqual(b);
  });
});
