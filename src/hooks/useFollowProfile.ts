'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useToast } from '@/contexts/ToastContext';
import { readBody } from '@/lib/api/readBody';
import { queryKeys } from '@/lib/query/keys';
import type { Profile } from './useProfile';

class FollowError extends Error {
  constructor(readonly offline: boolean) {
    super(offline ? 'Offline' : 'Request rejected');
    this.name = 'FollowError';
  }
}

/** The follow fields of a cached public profile, rewritten; anything else passes through. */
const withFollow = (profile: Profile | undefined, isFollowing: boolean, followersCount: number) =>
  profile?.visibility === 'public'
    ? { ...profile, isFollowing, stats: { ...profile.stats, followersCount } }
    : profile;

/**
 * Follow or unfollow the person whose profile this is, and tell the truth about it.
 *
 * The same contract as a heart: the button flips at once, and a failure takes it back AND
 * says so. What it replaces flipped the button too, but printed "Loading…" over the flip
 * until the server answered, and on a failure changed it back with nothing but a
 * `console.error` — the reader saw the button undo itself and was never told why.
 *
 * The rollback puts back only the two follow fields, not the whole cached profile. A
 * heart tapped on this page while the follow was in flight lives in the same entry, and
 * restoring a snapshot would have undone it too.
 */
export function useFollowProfile(username: string) {
  const queryClient = useQueryClient();
  const { showError } = useToast();
  const t = useTranslations('profile');
  const key = queryKeys.profile(username);

  const mutation = useMutation({
    mutationKey: ['follow', username],

    mutationFn: async (next: boolean) => {
      let response: Response;
      try {
        response = await fetch(`/api/users/${username}/${next ? 'follow' : 'unfollow'}`, {
          method: 'POST',
          headers: { 'X-Requested-With': 'fetch' },
        });
      } catch {
        throw new FollowError(true);
      }

      const body = await readBody(response);
      if (!response.ok) throw new FollowError(false);
      return body as { followersCount?: unknown } | null;
    },

    onMutate: (next) => {
      const before = queryClient.getQueryData<Profile>(key);
      if (before?.visibility !== 'public') return undefined;

      const count = before.stats.followersCount;
      queryClient.setQueryData<Profile>(key, (profile) =>
        withFollow(profile, next, Math.max(0, count + (next ? 1 : -1)))
      );
      return { wasFollowing: before.isFollowing ?? false, count };
    },

    onError: (error, next, context) => {
      if (context) {
        queryClient.setQueryData<Profile>(key, (profile) =>
          withFollow(profile, context.wasFollowing, context.count)
        );
      }

      const action = next ? 'follow' : 'unfollow';
      showError(
        error instanceof FollowError && error.offline
          ? t('followOffline', { action })
          : t('followFailed', { action })
      );
    },

    // Both routes answer with the real count, which the optimistic ±1 only guessed at —
    // someone else may have followed in the meantime.
    onSuccess: (body, next) => {
      const count = body?.followersCount;
      if (typeof count !== 'number') return;
      queryClient.setQueryData<Profile>(key, (profile) => withFollow(profile, next, count));
    },
  });

  return { toggle: (next: boolean) => mutation.mutate(next) };
}
