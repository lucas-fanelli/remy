'use client';
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useApiErrorMessage } from '@/lib/api/translateApiError';
import {
  FOLLOW_FAILURE_CODES,
  FollowActionError,
  afterFollowChange,
  followScope,
  followersDelta,
  guessFollowState,
  mergeAccessChanges,
  sendFollowAction,
  type AccessChange,
  type FollowAction,
} from '@/lib/follows/client/followAction';
import { queryKeys } from '@/lib/query/keys';
import type { Profile } from './useProfile';
import type { FollowState } from '@/domain/types/follow';

/** The two fields a follow touches in a cached profile. Nothing else is ever written back. */
interface FollowFields {
  followState: FollowState | null;
  followersCount: number;
}

/**
 * A burst of taps on one account: every tap made while an earlier one is still waiting on
 * the server joins the burst, and they all share this object.
 *
 * Why a burst needs one: each tap paints at once, but the requests run one at a time
 * (`followScope`). So when a request answers, the paint on screen may already be a LATER
 * tap's guess — and "put back what was there before this tap" would put back a guess the
 * server never confirmed. What a failure goes back to is `settled` instead: the server's
 * last word, or the cache as it was before the burst began.
 */
interface FollowBurst {
  settled: FollowFields;
  /** What the burst has done to access so far, so the profile refetches once, at the end. */
  access: AccessChange;
  /**
   * A tap of the burst cancelled a read of the profile that was already on its way, and the
   * burst sends it again when it settles. That read is most often the previous burst's
   * relock or unlock, and this burst's own `access` cannot stand in for it: "Seguir" tapped
   * on a private account just unfollowed is answered 'requested', which changes nothing
   * from where the server had the viewer, yet the page still shows the recipes the unfollow
   * took away — and the paint marks that entry fresh, so no later read would come for it.
   */
  refetchOwed: boolean;
  /**
   * The full view of a private account that an unfollow locked at once, kept until the burst
   * settles: if the server says the reader still follows, the recipes come back from here.
   */
  unlocked: FullProfile | null;
  /** Taps in the burst still waiting on the server. The last one out paints the result. */
  inFlight: number;
}

type FullProfile = Extract<Profile, { visibility: 'public' }>;

/**
 * A private account as the route shows it to someone it keeps out: who it is and the three
 * counts, without recipes and without the website.
 */
const lockedView = ({ user, stats, followState }: FullProfile): Profile => ({
  visibility: 'private',
  user: {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    avatar: user.avatar,
    bio: user.bio,
    isPrivate: true,
  },
  stats,
  followState,
});

interface FollowContext {
  burst: FollowBurst;
}

/**
 * The bursts under way, per QueryClient and account. Module-level rather than a ref: the
 * requests outlive the component that sent them, and a profile left and reopened mid-burst
 * must join the burst still running rather than start a second, unaware one.
 */
const bursts = new WeakMap<QueryClient, Map<string, FollowBurst>>();

function joinBurst(queryClient: QueryClient, username: string, current: FollowFields) {
  let byAccount = bursts.get(queryClient);
  if (!byAccount) {
    byAccount = new Map();
    bursts.set(queryClient, byAccount);
  }

  let burst = byAccount.get(username);
  if (!burst) {
    burst = { settled: current, access: null, refetchOwed: false, unlocked: null, inFlight: 0 };
    byAccount.set(username, burst);
  }

  burst.inFlight += 1;
  return burst;
}

function leaveBurst(queryClient: QueryClient, username: string, burst: FollowBurst) {
  burst.inFlight -= 1;
  const byAccount = bursts.get(queryClient);
  if (burst.inFlight === 0 && byAccount?.get(username) === burst) byAccount.delete(username);
}

const fieldsOf = (profile: Profile | undefined): FollowFields => ({
  followState: profile?.followState ?? null,
  followersCount: profile?.stats.followersCount ?? 0,
});

/** The follow fields of a cached profile, rewritten; anything else passes through. */
const withFollow = (profile: Profile | undefined, fields: FollowFields): Profile | undefined =>
  profile && {
    ...profile,
    followState: fields.followState,
    stats: { ...profile.stats, followersCount: fields.followersCount },
  };

/**
 * Follow, request, cancel or unfollow the person whose profile this is, and tell the truth
 * about it.
 *
 * The same contract as a heart: the button flips at once, and a failure takes it back AND
 * says so — "sin conexión" told apart from a refusal. What it replaced flipped the button
 * too, but printed "Loading…" over the flip until the server answered, and on a failure
 * changed it back with nothing but a `console.error`.
 *
 * - follow (public account): 'none' → 'following', and one more follower.
 * - request (private account): 'none' → 'requested'. The count does not move: a request is
 *   not a follower.
 * - cancel: 'requested' → 'none', count unchanged.
 * - unfollow: 'following' → 'none', one follower fewer.
 *
 * The server's answer wins. `follow` answers the state it reached — an account that went
 * private since the page loaded answers 'requested' to a guessed 'following' — and
 * `unfollow` answers what there `was`; both answer the real follower count, which the ±1
 * only guessed at. The paint settles on those.
 *
 * When the answer changes what the viewer may SEE of a private account — they are in, or
 * out — the profile refetches (the lock comes off, or goes back on) and every other cache
 * that shows recipes is told: see afterFollowChange.
 *
 * Rapid taps do not interleave. All requests for one account share a mutation scope, so
 * they reach the server in the order they were tapped, one at a time, while each tap still
 * paints at once. A burst of taps settles as one: see FollowBurst.
 *
 * Only the two follow fields are ever written back, never a snapshot of the whole cached
 * profile. A heart tapped on this page while the follow was in flight lives in the same
 * entry, and restoring a snapshot would have undone it too.
 */
export function useFollowProfile(username: string) {
  const queryClient = useQueryClient();
  const { user: viewer } = useAuth();
  const { showError } = useToast();
  const apiErrorMessage = useApiErrorMessage();
  const t = useTranslations('profile');
  const key = queryKeys.profile(username);

  const paint = (fields: FollowFields) =>
    queryClient.setQueryData<Profile>(key, (profile) => withFollow(profile, fields));

  /** The last tap of a burst is answered: show where things landed. */
  const settle = (burst: FollowBurst) => {
    // Locked at the tap, but the server says the reader still follows: the unfollow failed,
    // and the recipes it hid are theirs to see again.
    if (burst.unlocked && burst.settled.followState === 'following') {
      queryClient.setQueryData<Profile>(key, burst.unlocked);
      // The copy is from before the tap; a heart given to one of those recipes elsewhere in
      // the meantime is not in it. The read below brings it up to date.
      burst.refetchOwed = true;
    }
    paint(burst.settled);
    // Only now, with nothing queued behind: a refetch while a later tap still waited could
    // answer before that tap reached the server and paint over its guess with the old state.
    if (burst.access !== null || burst.refetchOwed) {
      void queryClient.invalidateQueries({ queryKey: key });
    }
  };

  const { mutate } = useMutation({
    mutationKey: queryKeys.followMutation(username),
    scope: followScope(username),

    mutationFn: (action: FollowAction) => sendFollowAction(username, action),

    onMutate: async (action): Promise<FollowContext> => {
      // A refetch already on its way would land on top of the paint below, with the answer
      // from before the tap. Cancelled, it is owed rather than dropped: see refetchOwed.
      // Paused waiting for the network counts too — cancelQueries takes those as well.
      const cutShort = queryClient
        .getQueryCache()
        .findAll({ queryKey: key })
        .some((query) => query.state.fetchStatus !== 'idle');
      await queryClient.cancelQueries({ queryKey: key });

      const cached = queryClient.getQueryData<Profile>(key);
      const current = fieldsOf(cached);
      const burst = joinBurst(queryClient, username, current);
      if (cutShort) burst.refetchOwed = true;

      // Unfollowing a private account takes its recipes away, and they go now rather than
      // when the server has answered and the profile has been read again — two round trips
      // Lucas timed at four seconds in production. Hiding something cannot show anything it
      // should not, so it needs no answer first; if the unfollow fails, settle brings the
      // recipes back.
      if (action === 'unfollow' && cached?.visibility === 'public' && cached.user.isPrivate) {
        burst.unlocked ??= cached;
        queryClient.setQueryData<Profile>(key, lockedView(cached));
      }

      // Paint first — the whole point, and why the button has no loading state.
      const guess = guessFollowState(action);
      paint({
        followState: guess,
        followersCount: Math.max(
          0,
          current.followersCount + followersDelta(current.followState ?? 'none', guess)
        ),
      });

      return { burst };
    },

    onSuccess: (result, _action, { burst }) => {
      const before = burst.settled;
      const access = afterFollowChange(queryClient, {
        username,
        isPrivate: queryClient.getQueryData<Profile>(key)?.user.isPrivate ?? false,
        before: before.followState ?? 'none',
        result,
        viewer: viewer?.username ?? null,
      });

      burst.settled = {
        followState: result.state,
        followersCount:
          result.followersCount ??
          Math.max(
            0,
            before.followersCount + followersDelta(before.followState ?? 'none', result.state)
          ),
      };
      burst.access = mergeAccessChanges(burst.access, access);

      if (burst.inFlight === 1) settle(burst);
    },

    onError: (error, action, context) => {
      if (!context) return;
      const { burst } = context;

      // A later tap is queued behind this one: it will settle the paint, and the reader has
      // already moved on from what this tap asked for.
      if (burst.inFlight > 1) return;

      settle(burst);

      // Nothing to report when an earlier tap of the burst already got the reader where
      // this one wanted to go.
      if (burst.settled.followState === guessFollowState(action)) return;

      const failed = t('followFailed', { action });
      const body = error instanceof FollowActionError ? error.body : null;
      const code = (body as { code?: unknown } | null)?.code;

      showError(
        error instanceof FollowActionError && error.offline
          ? t('followOffline', { action })
          : // The route's catch-all cannot say which way it failed; this can. A specific
            // code — an expired session, an account that no longer exists — still speaks
            // for itself.
            typeof code === 'string' && FOLLOW_FAILURE_CODES.includes(code)
            ? failed
            : apiErrorMessage(body, failed)
      );
    },

    onSettled: (_result, _error, _action, context) => {
      if (context) leaveBurst(queryClient, username, context.burst);
    },
  });

  /**
   * Run one action on this profile. Fire and forget: the paint, the rollback and the toast
   * are all handled here. Which action a tap means is FollowButton's call — it is also what
   * asks before unfollowing a private account.
   */
  const act = useCallback((action: FollowAction) => mutate(action), [mutate]);

  return { act };
}
