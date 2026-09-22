'use client';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/keys';
import type { ViewerState } from '@/domain/types/recipe';

export interface ProfileUser {
  id: string;
  username: string;
  fullName?: string | null;
  bio?: string | null;
  avatar?: string | null;
  website?: string | null;
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
 * The route has always sent a separate, smaller payload for a private profile viewed by
 * someone else: the person, and nothing about their recipes or their counts. The page had
 * one type that assumed every answer carried `stats`, stored the missing field as the
 * stats, then read `stats.recipesCount` — and the page crashed to a blank screen for
 * anyone opening a private profile. Reproduced before fixing: `TypeError: Cannot read
 * properties of undefined (reading 'recipesCount')`.
 *
 * A union means the private case cannot be rendered without being handled.
 */
export type Profile =
  | { visibility: 'private'; user: ProfileUser }
  | {
      visibility: 'public';
      user: ProfileUser;
      stats: ProfileStats;
      recipes: ProfileRecipe[];
      /** Empty on anyone else's profile: the route only sends it to the owner. */
      savedRecipes: ProfileRecipe[];
      /** `null` when nobody is signed in, or on your own profile, where it means nothing. */
      isFollowing: boolean | null;
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
  user: ProfileUser;
  stats?: ProfileStats;
  recipes?: ProfileRecipe[];
  savedRecipes?: ProfileRecipe[];
  isFollowing?: boolean;
  isPrivateProfile?: boolean;
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

      if (data.isPrivateProfile) {
        return { visibility: 'private', user: data.user };
      }

      // Every public answer carries the counts. One that does not is broken, and showing
      // "0 followers" for it would be inventing a number rather than admitting a failure.
      if (!data.stats) throw new ProfileFetchError(response.status);

      return {
        visibility: 'public',
        user: data.user,
        stats: data.stats,
        recipes: data.recipes ?? [],
        savedRecipes: data.savedRecipes ?? [],
        isFollowing: data.isFollowing ?? null,
      };
    },
    // Asking again will not make a missing person exist, and the one retry the app allows
    // by default would hold "we couldn't find this person" back by a second for nothing.
    retry: (failureCount, error) =>
      !(error instanceof ProfileFetchError && error.status === 404) && failureCount < 1,
  });
}
