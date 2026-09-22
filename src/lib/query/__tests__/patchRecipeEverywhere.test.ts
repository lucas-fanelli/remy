import { QueryClient } from '@tanstack/react-query';
import { VIEWER_SPECS, type Engagement } from '@/lib/engagement/specs';
import { queryKeys } from '../keys';
import {
  invalidateRecipeLists,
  patchRecipeEverywhere,
  readEngagement,
  removeRecipeEverywhere,
} from '../patchRecipeEverywhere';

/** `removeRecipeEverywhere` marks the lists stale without awaiting it; let that land. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

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

describe('a search result in the cache', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('is reached, even though another adapter claims its key first', () => {
    // The bug this guards: every search key starts with `'recipes'`, which the
    // infinite-list adapter also answers to. A dispatcher taking "the first adapter that
    // matches" let that one claim the key, find no `pages`, hand the payload back
    // untouched — and the search adapter never ran. A heart tapped in search would have
    // moved nothing.
    queryClient.setQueryData(queryKeys.search('empanadas'), {
      users: [],
      recipes: [recipe('a')],
    });

    patchRecipeEverywhere(queryClient, 'a', like(true));

    const data = queryClient.getQueryData<{ recipes: { viewer: { liked: boolean } }[] }>(
      queryKeys.search('empanadas')
    );
    expect(data?.recipes[0].viewer.liked).toBe(true);
  });

  it('never touches the users beside the recipes', () => {
    // An adapter that walked the payload for anything with an `id` would find the people
    // too. A heart must not be able to reach a person.
    const users = [{ id: 'a', username: 'shares-an-id-with-the-recipe' }];
    queryClient.setQueryData(queryKeys.search('x'), { users, recipes: [recipe('a')] });

    patchRecipeEverywhere(queryClient, 'a', like(true));

    const data = queryClient.getQueryData<{ users: unknown[] }>(queryKeys.search('x'));
    expect(data?.users).toBe(users);
  });

  it('can be read back, which is what decides like versus unlike', () => {
    queryClient.setQueryData(queryKeys.search('x'), {
      users: [],
      recipes: [
        recipe('a', {
          viewer: { liked: true, saved: false, timesCooked: 0, lastCookedAt: null, myRating: null },
        }),
      ],
    });

    expect(VIEWER_SPECS.like.read(readEngagement(queryClient, 'a')!)).toBe(true);
  });
});

describe('the pantry matches in the cache', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('reaches a recipe in either bucket', () => {
    // The adapter names both lists so it does not have to know which one the route put a
    // recipe in. Holding only the first would leave every "almost there" heart dead.
    queryClient.setQueryData(queryKeys.matched(), {
      readyToCook: [recipe('a')],
      almostThere: [recipe('b')],
      pantryItemsCount: 2,
    });

    patchRecipeEverywhere(queryClient, 'b', like(true));

    const data = queryClient.getQueryData<{
      almostThere: { viewer: { liked: boolean }; likeCount: number }[];
    }>(queryKeys.matched());
    expect(data?.almostThere[0].viewer.liked).toBe(true);
    expect(data?.almostThere[0].likeCount).toBe(4);
  });

  it('leaves the other bucket and the pantry count exactly as they were', () => {
    const readyToCook = [recipe('a')];
    queryClient.setQueryData(queryKeys.matched(), {
      readyToCook,
      almostThere: [recipe('b')],
      pantryItemsCount: 2,
    });

    patchRecipeEverywhere(queryClient, 'b', like(true));

    const data = queryClient.getQueryData<{ readyToCook: unknown[]; pantryItemsCount: number }>(
      queryKeys.matched()
    );
    // The same reference, so the list that did not change does not re-render.
    expect(data?.readyToCook).toBe(readyToCook);
    expect(data?.pantryItemsCount).toBe(2);
  });

  it('can be read back, which is what decides like versus unlike', () => {
    queryClient.setQueryData(queryKeys.matched(), {
      readyToCook: [],
      almostThere: [
        recipe('a', {
          viewer: { liked: true, saved: false, timesCooked: 0, lastCookedAt: null, myRating: null },
        }),
      ],
      pantryItemsCount: 1,
    });

    expect(VIEWER_SPECS.like.read(readEngagement(queryClient, 'a')!)).toBe(true);
  });
});

describe('a profile in the cache', () => {
  let queryClient: QueryClient;

  const profile = (over: Record<string, unknown> = {}) => ({
    visibility: 'public',
    user: { id: 'a', username: 'shares-an-id-with-the-recipe' },
    stats: { recipesCount: 1, followersCount: 0, followingCount: 0 },
    recipes: [recipe('a')],
    savedRecipes: [recipe('b')],
    isFollowing: null,
    ...over,
  });

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('reaches a recipe on either tab', () => {
    queryClient.setQueryData(queryKeys.profile('ana'), profile());

    patchRecipeEverywhere(queryClient, 'b', like(true));

    const data = queryClient.getQueryData<{ savedRecipes: { viewer: { liked: boolean } }[] }>(
      queryKeys.profile('ana')
    );
    expect(data?.savedRecipes[0].viewer.liked).toBe(true);
  });

  it('never touches the person whose profile it is', () => {
    // `user` sits beside the lists and has an `id` too — here the same id as the recipe.
    const data = profile();
    queryClient.setQueryData(queryKeys.profile('ana'), data);

    patchRecipeEverywhere(queryClient, 'a', like(true));

    const after = queryClient.getQueryData<{ user: unknown; stats: unknown }>(
      queryKeys.profile('ana')
    );
    expect(after?.user).toBe(data.user);
    expect(after?.stats).toBe(data.stats);
  });

  it('leaves a private profile alone, which has no lists to patch', () => {
    const data = { visibility: 'private', user: { id: 'a', username: 'ana' } };
    queryClient.setQueryData(queryKeys.profile('ana'), data);

    patchRecipeEverywhere(queryClient, 'a', like(true));

    expect(queryClient.getQueryData(queryKeys.profile('ana'))).toBe(data);
  });

  it('can be read back, which is what decides like versus unlike', () => {
    queryClient.setQueryData(
      queryKeys.profile('ana'),
      profile({
        recipes: [
          recipe('a', {
            viewer: {
              liked: true,
              saved: false,
              timesCooked: 0,
              lastCookedAt: null,
              myRating: null,
            },
          }),
        ],
      })
    );

    expect(VIEWER_SPECS.like.read(readEngagement(queryClient, 'a')!)).toBe(true);
  });
});

describe('removeRecipeEverywhere', () => {
  let queryClient: QueryClient;
  const feedKey = queryKeys.feed({ difficulty: 'all', time: 'any', sort: 'newest' });

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  const seedEveryList = () => {
    queryClient.setQueryData(feedKey, {
      pages: [{ recipes: [recipe('gone'), recipe('stays')] }],
      pageParams: [0],
    });
    queryClient.setQueryData(queryKeys.search('x'), {
      users: [{ id: 'gone', username: 'shares-an-id' }],
      recipes: [recipe('gone')],
    });
    queryClient.setQueryData(queryKeys.matched(), {
      readyToCook: [recipe('gone')],
      almostThere: [recipe('stays')],
      pantryItemsCount: 2,
    });
    queryClient.setQueryData(queryKeys.profile('ana'), {
      visibility: 'public',
      user: { id: 'u', username: 'ana' },
      stats: { recipesCount: 1, followersCount: 0, followingCount: 0 },
      recipes: [recipe('gone')],
      savedRecipes: [recipe('gone')],
      isFollowing: null,
    });
  };

  const ids = (list: { id: string }[] | undefined) => list?.map((r) => r.id);

  it('takes a deleted recipe out of every list at once, not just the feed', () => {
    // The feed's own delete filtered the feed's pages and nothing else, so the recipe stayed
    // on its author's profile, in search, and in the pantry matches on the same page.
    seedEveryList();

    removeRecipeEverywhere(queryClient, 'gone');

    type Feed = { pages: { recipes: { id: string }[] }[] };
    expect(ids(queryClient.getQueryData<Feed>(feedKey)?.pages[0].recipes)).toEqual(['stays']);
    type Search = { recipes: { id: string }[] };
    expect(ids(queryClient.getQueryData<Search>(queryKeys.search('x'))?.recipes)).toEqual([]);
    type Matches = { readyToCook: { id: string }[]; almostThere: { id: string }[] };
    const matches = queryClient.getQueryData<Matches>(queryKeys.matched());
    expect(ids(matches?.readyToCook)).toEqual([]);
    expect(ids(matches?.almostThere)).toEqual(['stays']);
    type Profile = { recipes: { id: string }[]; savedRecipes: { id: string }[] };
    const profile = queryClient.getQueryData<Profile>(queryKeys.profile('ana'));
    expect(ids(profile?.recipes)).toEqual([]);
    expect(ids(profile?.savedRecipes)).toEqual([]);
  });

  it('never removes a person who happens to share the id', () => {
    seedEveryList();

    removeRecipeEverywhere(queryClient, 'gone');

    const search = queryClient.getQueryData<{ users: { id: string }[] }>(queryKeys.search('x'));
    expect(ids(search?.users)).toEqual(['gone']);
  });

  it("leaves the recipe's own page entry to the page", () => {
    // Dropping it while that page is still mounted would make the page refetch a 404 on its
    // way out.
    const detail = { recipe: recipe('gone') };
    queryClient.setQueryData(queryKeys.recipe('gone'), detail);

    removeRecipeEverywhere(queryClient, 'gone');

    expect(queryClient.getQueryData(queryKeys.recipe('gone'))).toBe(detail);
  });

  it('marks every list stale, since counts and page boundaries moved too', async () => {
    seedEveryList();

    removeRecipeEverywhere(queryClient, 'gone');

    await settle();
    for (const key of [
      feedKey,
      queryKeys.search('x'),
      queryKeys.matched(),
      queryKeys.profile('ana'),
    ]) {
      expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true);
    }
  });
});

describe('invalidateRecipeLists', () => {
  let queryClient: QueryClient;
  const feedKey = queryKeys.feed({ difficulty: 'all', time: 'any', sort: 'newest' });

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('marks the lists stale without refetching any of them', async () => {
    // Refetching now would re-download every page of a feed scrolled deep, for a change the
    // reader can already see. Stale is enough: the next screen to show a list refetches it.
    const queryFn = jest.fn().mockResolvedValue({ pages: [], pageParams: [] });
    queryClient.setQueryData(feedKey, { pages: [], pageParams: [] });
    queryClient.setQueryDefaults(feedKey, { queryFn });

    await invalidateRecipeLists(queryClient);

    expect(queryClient.getQueryState(feedKey)?.isInvalidated).toBe(true);
    expect(queryFn).not.toHaveBeenCalled();
  });

  it("leaves a recipe's own page alone, which is not a list", async () => {
    queryClient.setQueryData(queryKeys.recipe('a'), { recipe: recipe('a') });

    await invalidateRecipeLists(queryClient);

    expect(queryClient.getQueryState(queryKeys.recipe('a'))?.isInvalidated).toBe(false);
  });
});

describe('readEngagement', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('finds a recipe that is only in an infinite list', () => {
    // The bug this is here for: a toggle that read only `['recipe', id]` found nothing for
    // a recipe sitting in the feed's pages, assumed the flag was false, and therefore sent
    // `{ liked: true }` for a recipe the reader had ALREADY liked — deleting the like while
    // filling the heart in. That is the bug PR #7 closed, re-entering by another door, and
    // the feed's own regression test caught it.
    queryClient.setQueryData(queryKeys.feed({ difficulty: 'all', time: 'any', sort: 'newest' }), {
      pages: [{ recipes: [recipe('a', { likeCount: 5 })] }],
      pageParams: [0],
    });

    const engagement = readEngagement(queryClient, 'a');

    expect(engagement).not.toBeNull();
    expect(engagement?.viewer?.liked).toBe(false);
    expect(engagement?.likeCount).toBe(5);
  });

  it('reads the liked flag a list already carries', () => {
    queryClient.setQueryData(queryKeys.feed({ difficulty: 'all', time: 'any', sort: 'newest' }), {
      pages: [
        {
          recipes: [
            recipe('a', {
              viewer: {
                liked: true,
                saved: false,
                timesCooked: 0,
                lastCookedAt: null,
                myRating: null,
              },
            }),
          ],
        },
      ],
      pageParams: [0],
    });

    expect(VIEWER_SPECS.like.read(readEngagement(queryClient, 'a')!)).toBe(true);
  });

  it('finds it in the detail cache too', () => {
    queryClient.setQueryData(queryKeys.recipe('a'), { recipe: recipe('a', { likeCount: 2 }) });

    expect(readEngagement(queryClient, 'a')?.likeCount).toBe(2);
  });

  it('writes nothing while reading', () => {
    const before = { recipe: recipe('a') };
    queryClient.setQueryData(queryKeys.recipe('a'), before);

    readEngagement(queryClient, 'a');

    // It borrows the adapters' patch callback to capture the value; the mapped result has
    // to be discarded rather than stored.
    expect(queryClient.getQueryData(queryKeys.recipe('a'))).toBe(before);
  });

  it('answers null for a recipe in no cache', () => {
    expect(readEngagement(queryClient, 'nowhere')).toBeNull();
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
