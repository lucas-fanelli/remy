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
  /**
   * Every follow-request inbox: the root to invalidate after anything that answers requests
   * in bulk (making an account public accepts them all).
   *
   * A root of its own on purpose. 'profile' and 'recipes' are claimed by the recipe cache
   * adapters and by invalidateRecipeLists, and a list of people is neither: under either
   * root, a like or a new recipe would mark the inbox stale for nothing.
   */
  followRequests: () => ['followRequests'] as const,
  /**
   * One owner's inbox (GET /api/follow-requests), every page loaded so far.
   *
   * Keyed on the owner, unlike the keys above. Only logging out clears the cache: a session
   * that expires, followed by another account signing in on the same tab, keeps it. An inbox
   * is one person's private list — who is asking to follow them — and under a bare
   * ['followRequests'] the next account would have been shown it for up to a minute. Keyed on
   * the owner, the next account gets an entry of its own.
   */
  followRequestInbox: (ownerId: string) => ['followRequests', ownerId] as const,
} as const;

/** The first segment of every recipe-bearing key, for adapters that match by prefix. */
export const RECIPE_KEY_ROOTS = ['recipe', 'recipes'] as const;
