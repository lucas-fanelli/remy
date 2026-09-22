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

/**
 * The recipe detail page: `{ recipe: ApiRecipe }` under `['recipe', id]`.
 *
 * The only adapter for now, deliberately. The feed, search and profile caches join when
 * those screens stop holding their lists in `useState` — until then there is nothing of
 * theirs in the cache to patch, and pretending otherwise would be dead code that looks
 * like coverage.
 */
const detailAdapter: RecipeCacheAdapter = {
  matches: (key) => key[0] === 'recipe' && typeof key[1] === 'string',
  map: (data, recipeId, patch) => {
    if (!isDetailPayload(data) || data.recipe.id !== recipeId) return data;
    return { ...data, recipe: applyTo(data.recipe, patch) };
  },
};

export const RECIPE_CACHE_ADAPTERS: readonly RecipeCacheAdapter[] = [detailAdapter];

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
    const adapter = RECIPE_CACHE_ADAPTERS.find((candidate) => candidate.matches(entry.queryKey));
    if (!adapter) continue;

    const before = entry.state.data;
    if (before === undefined) continue;

    const after = adapter.map(before, recipeId, patch);
    if (after === before) continue;

    const key = entry.queryKey;
    queryClient.setQueryData(key, after);
    restores.push(() => queryClient.setQueryData(key, before));
  }

  return () => restores.forEach((restore) => restore());
}
