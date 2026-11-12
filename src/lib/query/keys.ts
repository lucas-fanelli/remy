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
   * Keyed on the owner, unlike the keys above. AuthContext empties the whole cache whenever
   * the signed-in account changes, so this is a second line rather than the only one: an
   * inbox is one person's private list — who is asking to follow them — and if anything ever
   * served a cache across accounts again, the next account would still get an entry of its
   * own rather than someone else's requests.
   */
  followRequestInbox: (ownerId: string) => ['followRequests', ownerId] as const,
  /**
   * The follow mutation for one account — the profile header's and each list row's. Not a
   * query: a mutation key, spelled here so the three places that use it cannot drift apart.
   */
  followMutation: (username: string) => ['follow', username] as const,
  /**
   * Every cached pantry: the root to invalidate after anything else that changes one —
   * cooking a recipe takes its ingredients out, undoing the cook puts them back.
   */
  pantries: () => ['pantry'] as const,
  /**
   * One account's pantry (GET /api/pantry). Keyed on the owner for the same reason as the
   * follow-request inbox: it is a private list, and the cache being emptied on every change
   * of account should not be the only thing standing between it and the next account.
   */
  pantry: (ownerId: string) => ['pantry', ownerId] as const,
} as const;

/** The first segment of every recipe-bearing key, for adapters that match by prefix. */
export const RECIPE_KEY_ROOTS = ['recipe', 'recipes'] as const;
