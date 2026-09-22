import { readBody } from '@/lib/api/readBody';
import { queryKeys } from '@/lib/query/keys';
import { invalidateRecipeLists } from '@/lib/query/patchRecipeEverywhere';
import type { FollowState } from '@/domain/types/follow';
import type { QueryClient } from '@tanstack/react-query';

/**
 * The client half of a follow: what a tap on the button means, sending it, and what the
 * server's answer changes in the cache.
 *
 * Two places follow people — the profile header (src/hooks/useFollowProfile.ts) and the
 * followers / following lists — and they used to share nothing: each had its own fetch,
 * and only the header did anything after it. With private accounts that difference stops
 * being cosmetic. Unfollowing a private account from a list page would have left its
 * recipes in the feed, in search and on its cached recipe pages, while the same unfollow
 * from the header took them away. One module, so the two cannot drift again.
 *
 * Client-safe: nothing here reaches Prisma. The server half is ../requests.ts.
 */

/**
 * What a tap asks for. Two routes, four meanings — the route cannot tell a follow from a
 * request, or an unfollow from a cancel, but the paint and the sentence after a failure
 * can, and must: "no pudimos enviar la solicitud" is not "no pudimos seguir a esta persona".
 */
export type FollowAction = 'follow' | 'request' | 'cancel' | 'unfollow';

/**
 * What a tap on the button means from where the viewer stands.
 *
 * A private account gets a request rather than a follow; which one actually happens is
 * the server's call (the account may have changed privacy since the page loaded), and its
 * answer wins over this guess.
 */
export function followActionFor(state: FollowState, isPrivate: boolean): FollowAction {
  switch (state) {
    case 'following':
      return 'unfollow';
    case 'requested':
      return 'cancel';
    case 'none':
      return isPrivate ? 'request' : 'follow';
  }
}

/** The state a tap paints before the server answers. */
export function guessFollowState(action: FollowAction): FollowState {
  if (action === 'follow') return 'following';
  if (action === 'request') return 'requested';
  return 'none';
}

/**
 * How the follower count moves between two states. Only 'following' is a follower: a
 * request never counts, so neither sending one nor taking it back moves the number.
 */
export function followersDelta(before: FollowState, after: FollowState): -1 | 0 | 1 {
  const was = before === 'following';
  const is = after === 'following';
  if (was === is) return 0;
  return is ? 1 : -1;
}

const FOLLOW_STATES: readonly unknown[] = ['none', 'requested', 'following'];

export const isFollowState = (value: unknown): value is FollowState =>
  FOLLOW_STATES.includes(value);

/**
 * One serial queue per account, for every screen that follows people. Pass it as the
 * mutation's `scope`: React Query then runs the requests one after another in the order
 * they were tapped, while each tap still paints at once (onMutate is not queued, only the
 * request is). Without it a fast "Seguir, Siguiendo" could reach the server as unfollow
 * then follow, and leave the reader following someone they had just unfollowed.
 */
export const followScope = (username: string) => ({ id: `follow:${username}` });

/** What the server settled on. Its word, not the guess painted before it answered. */
export interface FollowResult {
  /** Where the viewer stands now. */
  state: FollowState;
  /**
   * Unfollow and cancel only: what there was to take back. A cancel that raced the owner's
   * "Aceptar" answers 'following' here — it removed the follow that accept had just made —
   * which is how the client learns that access, not just a request, was lost.
   */
  was: FollowState | null;
  /** The account's followers after the change; null only when the answer did not say. */
  followersCount: number | null;
}

/** A failed follow, keeping the server's body so the toast can use its error code. */
export class FollowActionError extends Error {
  constructor(
    readonly body: unknown,
    /** The request never reached the server. Its own sentence: nothing was refused. */
    readonly offline: boolean
  ) {
    super(offline ? 'Offline' : 'Request rejected');
    this.name = 'FollowActionError';
  }
}

/** The route's catch-alls: they say "it failed" and nothing about which way. */
export const FOLLOW_FAILURE_CODES: readonly string[] = ['user.followFailed', 'user.unfollowFailed'];

/**
 * POST the action and return the server's answer.
 *
 *   follow / request → POST /api/users/{username}/follow   → { state, followersCount }
 *   unfollow / cancel → POST /api/users/{username}/unfollow → { state: 'none', was, followersCount }
 *
 * Throws FollowActionError: `offline` when fetch itself threw, otherwise with the body.
 */
export async function sendFollowAction(
  username: string,
  action: FollowAction
): Promise<FollowResult> {
  const adds = action === 'follow' || action === 'request';

  let response: Response;
  try {
    response = await fetch(
      `/api/users/${encodeURIComponent(username)}/${adds ? 'follow' : 'unfollow'}`,
      // The middleware refuses a write without it (CSRF).
      { method: 'POST', headers: { 'X-Requested-With': 'fetch' } }
    );
  } catch {
    // A thrown fetch is the network, not the server — the case Lucas asked to be told
    // apart from a refusal.
    throw new FollowActionError(null, true);
  }

  const body = await readBody(response);
  if (!response.ok) throw new FollowActionError(body, false);

  const answer = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;

  return {
    // An answer without a state keeps the guess rather than inventing a different one.
    state: isFollowState(answer.state) ? answer.state : guessFollowState(action),
    was: !adds && isFollowState(answer.was) ? answer.was : null,
    followersCount: typeof answer.followersCount === 'number' ? answer.followersCount : null,
  };
}

/** Whether the viewer can now see more of the account ('gained'), less ('lost'), or the same. */
export type AccessChange = 'gained' | 'lost' | null;

/** One settled follow change, as the caller knew the account before it. */
export interface FollowChange {
  /** The account followed, requested, cancelled or unfollowed. */
  username: string;
  /** Whether the account is private, as last read (a profile, a list row). */
  isPrivate: boolean;
  /** The viewer's state the caches were built on — the one the server has just replaced. */
  before: FollowState;
  /** What the server answered. */
  result: FollowResult;
  /** The signed-in viewer, whose own "siguiendo" count moves with a follow. */
  viewer?: string | null;
}

/**
 * What a settled change did to the viewer's access to the account's recipes.
 *
 * Access is "public, or followed". Two corrections on what the caller last read:
 * - an unfollow's `was` beats `before`: a request that was accepted while the page sat
 *   there was already a follow, and cancelling it loses access;
 * - a 'requested' answer proves the account is private, whatever the page last read: a
 *   public profile that went private mid-tap is locked now, and the caches that showed its
 *   recipes are wrong.
 */
export function accessChangeOf({
  isPrivate,
  before,
  result,
}: Pick<FollowChange, 'isPrivate' | 'before' | 'result'>): AccessChange {
  const had = !isPrivate || (result.was ?? before) === 'following';
  const privateNow = isPrivate || result.state === 'requested';
  const has = !privateNow || result.state === 'following';
  if (had === has) return null;
  return has ? 'gained' : 'lost';
}

/**
 * Two changes in a row, as one. 'lost' wins: its invalidations include everything 'gained'
 * does, and a burst that gained and then lost access may have cached content from between.
 */
export function mergeAccessChanges(first: AccessChange, second: AccessChange): AccessChange {
  if (first === 'lost' || second === 'lost') return 'lost';
  return first ?? second;
}

/** Every recipe's own page — `['recipe', id]` for any id — from the one place keys are spelled. */
const recipePagesRoot = () => [queryKeys.recipe('')[0]] as const;

/**
 * What the cache must forget after a follow change the server accepted. Shared by the
 * profile header and both list pages, so an unfollow means the same from either.
 *
 * - The follow relation moved (a follower was added or removed): the account's profile and
 *   the viewer's own are out of date — the followers count on one, "siguiendo" on the
 *   other. Marked stale, not refetched: neither is on screen from a list page, and the
 *   header writes the server's count into its own entry.
 * - Access changed (a private account, gained or lost): every recipe list — feed, search,
 *   pantry matches, profiles — was built for the old answer. Marked stale, as every write
 *   here does (invalidateRecipeLists explains why nothing refetches on the spot).
 * - Access was lost: every cached recipe page is dropped, not just marked stale. A stale
 *   entry is still painted on the next visit, and the recipe page keeps showing the data
 *   it has when the refetch answers 403 — so a stale mark alone would have gone on showing
 *   a recipe the reader can no longer see, under the lock. Dropped, the next visit loads
 *   from scratch and meets the lock. It is every recipe page rather than this author's
 *   because a recipe entry does not reliably say whose it is; this happens only on the rare
 *   unfollow of a private account, and costs one extra load per recipe page reopened.
 *
 * The profile on screen, if any, is the caller's to refetch: only the caller knows whether
 * more taps are still queued behind this one (see useFollowProfile).
 *
 * Returns the access change, so a caller can act on it.
 */
export function afterFollowChange(queryClient: QueryClient, change: FollowChange): AccessChange {
  const { username, before, result, viewer } = change;
  const access = accessChangeOf(change);

  if (followersDelta(result.was ?? before, result.state) !== 0) {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.profile(username),
      refetchType: 'none',
    });
    if (viewer) {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.profile(viewer),
        refetchType: 'none',
      });
    }
  }

  // Every ['profile', …] entry is a recipe list too, so this one call covers the account's
  // own profile as well.
  if (access !== null) void invalidateRecipeLists(queryClient);

  if (access === 'lost') void queryClient.resetQueries({ queryKey: recipePagesRoot() });

  return access;
}
