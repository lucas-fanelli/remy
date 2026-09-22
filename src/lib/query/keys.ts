/**
 * What the feed's three controls are set to.
 *
 * They are local `useState` in `RecipeFeed` today and only become a cache key when the
 * feed joins this layer, which is a later step. The shape is written here now because the
 * key builder below is what fixes it: whatever the feed ends up passing has to serialise
 * stably, and a loose `Record<string, string>` would let two different orderings of the
 * same filters produce two different caches.
 */
export interface FeedFilters {
  difficulty: string;
  time: string;
  sort: string;
}

/**
 * Every React Query key in the app, in one place.
 *
 * `['recipe', id]` was hand-written twice — once in `useRecipe` and once in the recipe
 * page's cache patcher — which worked only because both spellings happened to agree. A
 * third speller creating `['recipes', id]` would not fail, would not warn, and would
 * quietly give that screen a cache of its own that no mutation ever reaches. That is the
 * failure mode this file exists to make impossible rather than unlikely.
 *
 * `as const` on each return matters: the tuple type is what lets a cache adapter narrow on
 * `key[0]` without casting.
 */
export const queryKeys = {
  recipe: (id: string) => ['recipe', id] as const,
  feed: (filters: FeedFilters) => ['recipes', 'feed', filters] as const,
  matched: () => ['recipes', 'matched'] as const,
  search: (query: string) => ['recipes', 'search', query] as const,
  profile: (username: string) => ['profile', username] as const,
} as const;

/** The first segment of every recipe-bearing key, for adapters that match by prefix. */
export const RECIPE_KEY_ROOTS = ['recipe', 'recipes'] as const;
