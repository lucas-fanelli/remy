import type { Engagement } from '@/lib/engagement/specs';
import type { QueryClient } from '@tanstack/react-query';

/**
 * The fields this layer touches on a cached recipe, plus the identity it needs to find it.
 *
 * Deliberately not `ApiRecipe`: a patcher that cannot reach `title` cannot corrupt a list
 * while updating a heart.
 */
interface CachedRecipe {
  id: string;
  viewer?: Engagement['viewer'];
  likeCount?: number;
}

/**
 * How one cached payload shape stores recipes.
 *
 * The problem this solves: a recipe lives in several caches at once — the detail page, the
 * feed, a search, a profile tab — and each wraps it differently. Liking from the feed used
 * to update the feed's own `useState` and nothing else, so opening that recipe showed the
 * heart as it had been before the click.
 *
 * Registering a SHAPE once means every present and future viewer action reaches every
 * screen. This is the seam that replaces "each screen owns its own copy": adding the feed
 * later is one adapter, not one handler per action per screen.
 *
 * `data` is `unknown` because the cache genuinely holds different shapes, and the adapter
 * is the thing that knows which. Narrowing belongs inside each one rather than in a
 * generic parameter the call site has to satisfy.
 */
export interface RecipeCacheAdapter {
  /** Does this adapter understand the payload behind that key? */
  matches: (key: readonly unknown[]) => boolean;
  /**
   * Return a NEW payload with the patch applied to that one recipe, or `data` itself when
   * the recipe is not in there. Returning the same reference is how React Query knows
   * nothing moved and skips a render.
   */
  map: (data: unknown, recipeId: string, patch: (e: Engagement) => Engagement) => unknown;
  /** A NEW payload without that recipe, or `data` itself when it is not in there. */
  remove: (data: unknown, recipeId: string) => unknown;
}

/** Take the engagement slice out of a recipe, apply the patch, put it back. */
function applyTo<T extends CachedRecipe>(recipe: T, patch: (e: Engagement) => Engagement): T {
  const next = patch({
    viewer: recipe.viewer ?? null,
    likeCount: recipe.likeCount ?? 0,
  });

  return { ...recipe, viewer: next.viewer, likeCount: next.likeCount };
}

function isDetailPayload(data: unknown): data is { recipe: CachedRecipe } {
  return (
    typeof data === 'object' &&
    data !== null &&
    'recipe' in data &&
    typeof (data as { recipe?: unknown }).recipe === 'object' &&
    (data as { recipe: { id?: unknown } }).recipe !== null &&
    typeof (data as { recipe: { id?: unknown } }).recipe.id === 'string'
  );
}

/** The recipe detail page: `{ recipe: ApiRecipe }` under `['recipe', id]`. */
const detailAdapter: RecipeCacheAdapter = {
  matches: (key) => key[0] === 'recipe' && typeof key[1] === 'string',
  map: (data, recipeId, patch) => {
    if (!isDetailPayload(data) || data.recipe.id !== recipeId) return data;
    return { ...data, recipe: applyTo(data.recipe, patch) };
  },
  // A deleted recipe's own page entry is not a list, and dropping it from under that page
  // while it is still mounted would make it refetch a 404 on its way out. It ages out of
  // the cache like any other entry nobody is reading.
  remove: (data) => data,
};

function isInfinitePages(data: unknown): data is { pages: { recipes: CachedRecipe[] }[] } {
  return (
    typeof data === 'object' &&
    data !== null &&
    Array.isArray((data as { pages?: unknown }).pages) &&
    (data as { pages: unknown[] }).pages.every(
      (page) =>
        typeof page === 'object' &&
        page !== null &&
        Array.isArray((page as { recipes?: unknown }).recipes)
    )
  );
}

/**
 * The feed and any other `useInfiniteQuery` list: `{ pages: [{ recipes: [...] }], … }`.
 *
 * Only the page holding that recipe is rebuilt, and only if the recipe is in it. Rebuilding
 * every page on every heart would make each like re-render the whole list.
 */
const infiniteListAdapter: RecipeCacheAdapter = {
  matches: (key) => key[0] === 'recipes',
  map: (data, recipeId, patch) => {
    if (!isInfinitePages(data)) return data;

    let touched = false;
    const pages = data.pages.map((page) => {
      if (!page.recipes.some((recipe) => recipe.id === recipeId)) return page;
      touched = true;
      return {
        ...page,
        recipes: page.recipes.map((recipe) =>
          recipe.id === recipeId ? applyTo(recipe, patch) : recipe
        ),
      };
    });

    return touched ? { ...data, pages } : data;
  },
  remove: (data, recipeId) => {
    if (!isInfinitePages(data)) return data;

    let touched = false;
    const pages = data.pages.map((page) => {
      if (!page.recipes.some((recipe) => recipe.id === recipeId)) return page;
      touched = true;
      return { ...page, recipes: page.recipes.filter((recipe) => recipe.id !== recipeId) };
    });

    return touched ? { ...data, pages } : data;
  },
};

function isCachedRecipe(value: unknown): value is CachedRecipe {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { id?: unknown }).id === 'string'
  );
}

/**
 * A payload that keeps recipes in one or more named arrays at its top level —
 * `{ users, recipes }` for search, `{ readyToCook, almostThere }` for the pantry matches,
 * `{ recipes, savedRecipes }` for a profile.
 *
 * One helper, registered once per shape with the fields it owns, rather than an adapter
 * that walks any object looking for things with an `id`. That would also find the users in
 * a search result, and a heart must never be able to reach a person.
 */
function namedListsAdapter(
  matches: (key: readonly unknown[]) => boolean,
  fields: readonly string[]
): RecipeCacheAdapter {
  return {
    matches,
    map: (data, recipeId, patch) => {
      if (typeof data !== 'object' || data === null) return data;
      const record = data as Record<string, unknown>;

      let touched = false;
      const next: Record<string, unknown> = { ...record };
      for (const field of fields) {
        const list = record[field];
        if (!Array.isArray(list)) continue;
        if (!list.some((recipe) => isCachedRecipe(recipe) && recipe.id === recipeId)) continue;

        touched = true;
        next[field] = list.map((recipe) =>
          isCachedRecipe(recipe) && recipe.id === recipeId ? applyTo(recipe, patch) : recipe
        );
      }

      return touched ? next : data;
    },
    remove: (data, recipeId) => {
      if (typeof data !== 'object' || data === null) return data;
      const record = data as Record<string, unknown>;

      let touched = false;
      const next: Record<string, unknown> = { ...record };
      for (const field of fields) {
        const list = record[field];
        if (!Array.isArray(list)) continue;
        if (!list.some((recipe) => isCachedRecipe(recipe) && recipe.id === recipeId)) continue;

        touched = true;
        next[field] = list.filter((recipe) => !(isCachedRecipe(recipe) && recipe.id === recipeId));
      }

      return touched ? next : data;
    },
  };
}

/** `{ users, recipes }` under `['recipes', 'search', query]`. */
const searchAdapter = namedListsAdapter(
  (key) => key[0] === 'recipes' && key[1] === 'search',
  ['recipes']
);

/**
 * `{ readyToCook, almostThere, pantryItemsCount }` under `['recipes', 'matched']`.
 *
 * One recipe can only be in one of the two lists, but both are named: the adapter does not
 * have to know which bucket the route put it in.
 */
const matchesAdapter = namedListsAdapter(
  (key) => key[0] === 'recipes' && key[1] === 'matched',
  ['readyToCook', 'almostThere']
);

/**
 * `{ visibility, user, stats, recipes, savedRecipes, isFollowing }` under
 * `['profile', username]` — what `useProfile` stores, not what the route sends.
 *
 * `user` sits right beside the lists and has an `id` too. Naming the fields is what keeps
 * a heart away from the person whose profile it is.
 */
const profileAdapter = namedListsAdapter(
  (key) => key[0] === 'profile' && typeof key[1] === 'string',
  ['recipes', 'savedRecipes']
);

/**
 * Five shapes: the detail page's envelope, any infinite list, search, the pantry matches
 * and a profile's two tabs.
 *
 * More than one adapter can match a key: every search key starts with `'recipes'`, which
 * the infinite-list adapter also answers to. So nothing below picks "the first adapter
 * that matches" — each one that matches is tried until one actually finds the recipe.
 * Picking the first would have let the infinite-list adapter claim every search key, find
 * no pages, return the payload untouched, and the search adapter would never have run.
 */
export const RECIPE_CACHE_ADAPTERS: readonly RecipeCacheAdapter[] = [
  detailAdapter,
  infiniteListAdapter,
  searchAdapter,
  matchesAdapter,
  profileAdapter,
];

/** Every adapter that claims this key, in registration order. */
const adaptersFor = (key: readonly unknown[]) =>
  RECIPE_CACHE_ADAPTERS.filter((adapter) => adapter.matches(key));

/**
 * What the caches currently say about one recipe, from whichever one holds it.
 *
 * This exists because of a bug the feed's own regression test caught. A toggle that read
 * only `['recipe', id]` found nothing for a recipe sitting in the feed's pages, assumed
 * `liked: false`, and therefore sent `{ liked: true }` for a recipe the reader had already
 * liked — deleting the like while filling the heart in. That is precisely the bug PR #7
 * closed, re-entering through a different door.
 *
 * It reuses the adapters rather than adding a read method to them: the patch callback is
 * invoked only for the matching recipe, so passing an identity function that captures its
 * argument is a read. Nothing is written — the mapped result is discarded.
 */
export function readEngagement(queryClient: QueryClient, recipeId: string): Engagement | null {
  let found: Engagement | null = null;

  for (const entry of queryClient.getQueryCache().findAll()) {
    if (entry.state.data === undefined) continue;

    for (const adapter of adaptersFor(entry.queryKey)) {
      adapter.map(entry.state.data, recipeId, (engagement) => {
        found = engagement;
        return engagement;
      });
      if (found) return found;
    }
  }

  return found;
}

/**
 * Apply `patch` to every cached copy of one recipe, and hand back the exact way to undo it.
 *
 * The rollback closes over the values that were actually there, rather than re-deriving
 * what they probably were. The feed's like handler does re-derive — it snapshots
 * `{ viewer, likeCount }` before patching and writes that back — which is correct only
 * because it patches exactly one place. With several caches in play, "put it back the way
 * it was" has to mean each of them, individually.
 */
export function patchRecipeEverywhere(
  queryClient: QueryClient,
  recipeId: string,
  patch: (engagement: Engagement) => Engagement
): () => void {
  const restores: Array<() => void> = [];
  const entries = queryClient.getQueryCache().findAll();

  for (const entry of entries) {
    const before = entry.state.data;
    if (before === undefined) continue;

    // The first adapter that actually changes the payload wins; one that merely matches
    // the key and finds nothing is skipped rather than allowed to end the search.
    for (const adapter of adaptersFor(entry.queryKey)) {
      const after = adapter.map(before, recipeId, patch);
      if (after === before) continue;

      const key = entry.queryKey;
      queryClient.setQueryData(key, after);
      restores.push(() => queryClient.setQueryData(key, before));
      break;
    }
  }

  return () => restores.forEach((restore) => restore());
}

/** Every key root that holds lists of recipes. `'recipe'` (singular) is one page, not a list. */
const RECIPE_LIST_ROOTS = ['recipes', 'profile'] as const;

/**
 * Something about which recipes exist changed: every cached list is now out of date.
 *
 * Marked stale, not refetched. A list nobody is looking at refetches the next time a
 * screen shows it; a list on screen has either been patched by the write that got here
 * (the feed's own edit, `removeRecipeEverywhere`) or is about to be left (the editor
 * navigates to the new recipe). Refetching now would re-download every page of a feed
 * scrolled twenty pages deep for a change the reader can already see.
 *
 * The bug this closes arrived with the lists joining the cache. Before, each screen
 * fetched on every visit and could not be stale; after, with a 60-second freshness window,
 * publishing a recipe and going home inside that minute showed the feed without it, and a
 * recipe deleted from its own page was still in the feed, on the profile, in search.
 */
export function invalidateRecipeLists(queryClient: QueryClient): Promise<void> {
  return Promise.all(
    RECIPE_LIST_ROOTS.map((root) =>
      queryClient.invalidateQueries({ queryKey: [root], refetchType: 'none' })
    )
  ).then(() => undefined);
}

/**
 * A recipe was deleted: take it out of every cached list NOW, then mark them all stale.
 *
 * Now, because the reader just watched it go — the feed did this for its own delete, but
 * only for the feed, so the same recipe stayed on the profile, in search and in the pantry
 * matches. Stale as well, because a removal shifts what the server would put on each page
 * and changes counts (a profile's recipe total) that no adapter touches.
 */
export function removeRecipeEverywhere(queryClient: QueryClient, recipeId: string): void {
  for (const entry of queryClient.getQueryCache().findAll()) {
    const before = entry.state.data;
    if (before === undefined) continue;

    for (const adapter of adaptersFor(entry.queryKey)) {
      const after = adapter.remove(before, recipeId);
      if (after === before) continue;

      queryClient.setQueryData(entry.queryKey, after);
      break;
    }
  }

  void invalidateRecipeLists(queryClient);
}
