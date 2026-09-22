import { text, type TextDescriptor } from '@/i18n/text';
import { queryKeys } from '@/lib/query/keys';
import type { ViewerState } from '@/domain/types/recipe';

/**
 * The only home of optimistic policy.
 *
 * Liking and saving were two implementations of one idea, and they disagreed on every
 * axis: the feed's like painted immediately and rolled back, the recipe page's like waited
 * for the round trip, and both of the recipe page's handlers swallowed an HTTP rejection
 * entirely. Three versions of "toggle a boolean and tell the truth about it", one correct.
 *
 * Here they are two DATA objects fed to one implementation. Adding "follow" or "cooked"
 * later means adding a spec, not another handler — and `VIEWER_SPECS` below is what a test
 * iterates, so a third one cannot ship untested.
 */

/**
 * The only slice of a recipe payload this layer may touch.
 *
 * Narrow on purpose: a mutation that cannot reach `title` cannot corrupt a list. It is also
 * what lets one pure function paint every cache the recipe sits in, whatever shape that
 * cache's payload has around it.
 */
export interface Engagement {
  viewer: ViewerState | null;
  likeCount: number;
}

/** A sentence for turning the flag on, and one for turning it off. */
export interface Directional {
  on: TextDescriptor;
  off: TextDescriptor;
}

export interface ViewerSpec<TResponse> {
  readonly key: 'like' | 'save';

  /**
   * Both routes already converge on the state you asked for rather than flipping what they
   * find — `body: { liked: true }`, never `{ toggle: true }`. That is what makes a retry, a
   * second tab and a future offline replay safe, and it is why this layer can send the same
   * intent twice without inventing a different answer.
   */
  url: (recipeId: string) => string;
  body: (next: boolean) => object;

  /**
   * The code the route answers with when anything unexpected breaks. It is the same in
   * both directions — "recipe.saveFailed" for a failed UNsave too — so when it comes back,
   * the directional sentence below says it better than the server can.
   */
  serverFailureCode: string;

  /** What the screen currently claims, read from the cache rather than from a component. */
  read: (engagement: Engagement) => boolean;

  /** Pure, so the SAME function paints every cached copy of the recipe. */
  optimistic: (engagement: Engagement, next: boolean) => Engagement;

  /** Adopt the server's answer. Cannot widen beyond `Engagement`. */
  settle: (engagement: Engagement, data: TResponse) => Engagement;

  text: {
    on: TextDescriptor;
    off: TextDescriptor;
    /**
     * By direction — what the reader was trying to do — because a failure leaves the state
     * where it WAS, and that is the opposite of what they asked for. One sentence for both
     * got it backwards half the time: a failed unsave said "it was not saved" about a recipe
     * that still was, and a failed like said "we put your like back" while emptying it.
     */
    failed: Directional;
    /** Distinct from `failed`: the reader is owed "and I put it back", not "it broke". */
    offline: Directional;
    signedOut: TextDescriptor;
  };

  /**
   * Lists whose MEMBERSHIP this write changes, not just a flag on a recipe already in them.
   *
   * Saving from the feed puts a recipe into your profile's Saved tab, which no patch can
   * do — the tab does not hold that recipe yet. These are marked stale once the server has
   * answered, so the next visit refetches; never refetched on the spot, for the reason the
   * mutation hook records at its missing `onSettled`.
   */
  membership?: (reader: { username: string }) => ReadonlyArray<readonly unknown[]>;
}

/**
 * A viewer that has touched nothing.
 *
 * Only reached if a signed-in reader somehow holds a recipe whose `viewer` is null, which
 * the API does not produce. It keeps an optimistic patch from having to invent the other
 * three fields, and — unlike the default this replaces — it is never what gets rendered
 * without a real answer behind it.
 */
const UNTOUCHED: ViewerState = {
  liked: false,
  saved: false,
  timesCooked: 0,
  lastCookedAt: null,
  myRating: null,
};

interface LikeResponse {
  liked: boolean;
  likeCount: number;
}

interface SaveResponse {
  saved: boolean;
}

const likeSpec: ViewerSpec<LikeResponse> = {
  key: 'like',
  url: (recipeId) => `/api/recipes/${recipeId}/like`,
  body: (next) => ({ liked: next }),
  serverFailureCode: 'recipe.likeFailed',
  read: (engagement) => engagement.viewer?.liked ?? false,
  optimistic: (engagement, next) => ({
    viewer: { ...(engagement.viewer ?? UNTOUCHED), liked: next },
    // `Math.max(0, …)` because the count and the flag can disagree: a recipe liked in
    // another tab arrives here with `liked: false` and a count of 1, and unliking it
    // would otherwise render -1 for as long as the request is in flight.
    likeCount: next ? engagement.likeCount + 1 : Math.max(0, engagement.likeCount - 1),
  }),
  settle: (engagement, data) => ({
    viewer: engagement.viewer ? { ...engagement.viewer, liked: data.liked } : engagement.viewer,
    likeCount: data.likeCount,
  }),
  text: {
    on: text('recipe.toasts.liked'),
    off: text('recipe.toasts.unliked'),
    // "Couldn't update your like" is true either way; being offline is not.
    failed: { on: text('recipe.toasts.likeFailed'), off: text('recipe.toasts.likeFailed') },
    offline: { on: text('recipe.toasts.likeOffline'), off: text('recipe.toasts.unlikeOffline') },
    signedOut: text('recipe.toasts.loginToLike'),
  },
};

const saveSpec: ViewerSpec<SaveResponse> = {
  key: 'save',
  url: (recipeId) => `/api/recipes/${recipeId}/save`,
  body: (next) => ({ saved: next }),
  serverFailureCode: 'recipe.saveFailed',
  read: (engagement) => engagement.viewer?.saved ?? false,
  optimistic: (engagement, next) => ({
    ...engagement,
    viewer: { ...(engagement.viewer ?? UNTOUCHED), saved: next },
  }),
  settle: (engagement, data) => ({
    ...engagement,
    viewer: engagement.viewer ? { ...engagement.viewer, saved: data.saved } : engagement.viewer,
  }),
  text: {
    on: text('recipe.toasts.saved'),
    off: text('recipe.toasts.unsaved'),
    failed: { on: text('recipe.toasts.saveFailed'), off: text('recipe.toasts.unsaveFailed') },
    offline: { on: text('recipe.toasts.saveOffline'), off: text('recipe.toasts.unsaveOffline') },
    signedOut: text('recipe.toasts.loginToSave'),
  },
  // Your Saved tab. Unsaving from INSIDE it needs nothing here — the tab hides a recipe the
  // moment its bookmark empties — but saving anywhere else adds a recipe it does not hold.
  membership: (reader) => [queryKeys.profile(reader.username)],
};

/** The registry a test iterates, so a third spec cannot ship without being exercised. */
export const VIEWER_SPECS = { like: likeSpec, save: saveSpec } as const;

export type ViewerSpecKey = keyof typeof VIEWER_SPECS;
