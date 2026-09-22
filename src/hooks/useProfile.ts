'use client';
import { useQuery } from '@tanstack/react-query';
import { isFollowState } from '@/lib/follows/client/followAction';
import { queryKeys } from '@/lib/query/keys';
import type { FollowState } from '@/domain/types/follow';
import type { ViewerState } from '@/domain/types/recipe';

export interface ProfileUser {
  id: string;
  username: string;
  fullName?: string | null;
  bio?: string | null;
  avatar?: string | null;
  website?: string | null;
  /**
   * So the page knows what a tap on "Seguir" will do before the server answers: follow a
   * public account at once, or send a private one a request. Always true on the locked
   * variant; on the full one it says whether the viewer got in by following.
   */
  isPrivate: boolean;
}

/**
 * What `/api/users/[username]/profile` sends for a recipe on either tab.
 *
 * Written from the route, not from memory. The page's own copy of this type once declared
 * nine fields while the route sent fourteen, so `description`, both times, `servings` and
 * `viewer` arrived on every request and were discarded: profile cards had no description,
 * no time and no servings, and on your OWN profile your own liked recipes showed empty
 * hearts.
 */
export interface ProfileRecipe {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string;
  difficulty: string;
  prepTime: number | null;
  cookingTime: number | null;
  servings: number | null;
  likeCount: number;
  commentCount: number;
  averageRating?: number;
  totalRatings?: number;
  /** The saved tab only — the owner's own recipes need no byline. */
  author?: { username: string; avatar?: string };
  viewer: ViewerState | null;
}

export interface ProfileStats {
  recipesCount: number;
  followersCount: number;
  followingCount: number;
}

/**
 * The two answers the route gives, as two shapes rather than one with holes in it.
 *
 * `visibility` is about THIS viewer, not the account's setting: 'public' is the full view —
 * a public account, your own, or a private one you follow — and 'private' is the locked
 * view a private account shows everyone else. Whether the account itself is private is
 * `user.isPrivate`, which is how a full view of a private account you follow is told apart
 * (unfollowing that one takes the recipes away; unfollowing a public one does not).
 *
 * The locked view carries the person, the three counts and where the viewer stands — a
 * locked profile shows how many recipes and followers there are, and offers "Seguir" or
 * "Solicitado" — and nothing about the recipes themselves. The page once had one type that
 * assumed every answer carried everything, read `stats.recipesCount` off an answer that had
 * no stats, and crashed to a blank screen for anyone opening a private profile. A union
 * means the locked case cannot be rendered without being handled.
 */
export type Profile =
  | {
      visibility: 'private';
      user: ProfileUser;
      stats: ProfileStats;
      /** `null` when nobody is signed in. Never 'following': a follower gets the full view. */
      followState: FollowState | null;
    }
  | {
      visibility: 'public';
      user: ProfileUser;
      stats: ProfileStats;
      recipes: ProfileRecipe[];
      /** Empty on anyone else's profile: the route only sends it to the owner. */
      savedRecipes: ProfileRecipe[];
      /** `null` when nobody is signed in, or on your own profile, where it means nothing. */
      followState: FollowState | null;
    };

export class ProfileFetchError extends Error {
  constructor(readonly status: number | null) {
    super(`Failed to load profile (${status ?? 'network'})`);
    this.name = 'ProfileFetchError';
  }

  /** Which sentence the page shows: the failure is a state, not a string. */
  get reason(): 'userNotFound' | 'loadFailed' {
    return this.status === 404 ? 'userNotFound' : 'loadFailed';
  }
}

interface ProfileResponse {
  user: Omit<ProfileUser, 'isPrivate'> & { isPrivate?: boolean };
  stats?: ProfileStats;
  recipes?: ProfileRecipe[];
  savedRecipes?: ProfileRecipe[];
  followState?: FollowState | null;
  /** What the route sent before `followState`; it still does, for one release. */
  isFollowing?: boolean;
  isPrivateProfile?: boolean;
}

/**
 * Where the viewer stands, from the answer. `followState` is the route's word; an answer
 * without it — written before it existed — still says following or not through
 * `isFollowing`, which is all there was to say then.
 */
function followStateIn(data: ProfileResponse): FollowState | null {
  if (isFollowState(data.followState)) return data.followState;
  if (typeof data.isFollowing === 'boolean') return data.isFollowing ? 'following' : 'none';
  return null;
}

/**
 * One profile, in the cache, keyed by username.
 *
 * Being in the cache is what lets a heart on a profile card be tapped: the shared
 * mutation layer paints whatever the cache holds, and lists kept in `useState` were
 * invisible to it. Going back to a profile you just left is instant, too.
 */
export function useProfile(username: string) {
  return useQuery({
    queryKey: queryKeys.profile(username),
    queryFn: async ({ signal }): Promise<Profile> => {
      const response = await fetch(`/api/users/${username}/profile`, { signal });
      if (!response.ok) throw new ProfileFetchError(response.status);

      const data = (await response.json()) as ProfileResponse;

      // Every answer carries the counts, the locked one included. One that does not is
      // broken, and showing "0 followers" for it would be inventing a number rather than
      // admitting a failure.
      if (!data.stats) throw new ProfileFetchError(response.status);

      const followState = followStateIn(data);

      if (data.isPrivateProfile) {
        return {
          visibility: 'private',
          user: { ...data.user, isPrivate: true },
          stats: data.stats,
          followState,
        };
      }

      return {
        visibility: 'public',
        user: { ...data.user, isPrivate: data.user.isPrivate === true },
        stats: data.stats,
        recipes: data.recipes ?? [],
        savedRecipes: data.savedRecipes ?? [],
        followState,
      };
    },
    // Asking again will not make a missing person exist, and the one retry the app allows
    // by default would hold "we couldn't find this person" back by a second for nothing.
    retry: (failureCount, error) =>
      !(error instanceof ProfileFetchError && error.status === 404) && failureCount < 1,
  });
}
