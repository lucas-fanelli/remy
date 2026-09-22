'use client';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/keys';
import type { ViewerState } from '@/domain/types/recipe';

/**
 * What `/api/recipes/match` sends for one result — written off `MatchedRecipeData` in the
 * route, which is the only honest source for it.
 *
 * An earlier client-side copy of this type declared nine of the sixteen fields, and a
 * comment was written from that copy claiming the route sent no author and no viewer.
 * Both were false, and the cards were sparse because the data was discarded.
 */
export interface MatchedRecipe {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string;
  difficulty: string | null;
  prepTime: number | null;
  cookingTime: number | null;
  servings: number | null;
  matchPercentage: number;
  matchedIngredients: number;
  totalIngredients: number;
  missingIngredients: string[];
  likeCount: number;
  commentCount: number;
  /** The author, named `user` by this route where every other one says `author`. */
  user: { id: string; username: string; avatar: string | null } | null;
  viewer: ViewerState | null;
}

export interface MatchResults {
  readyToCook: MatchedRecipe[];
  almostThere: MatchedRecipe[];
  pantryItemsCount: number;
}

export class MatchFetchError extends Error {
  constructor() {
    super('Failed to load matched recipes');
    this.name = 'MatchFetchError';
  }
}

/**
 * The pantry matches, in the cache.
 *
 * The read itself was already honest about failure — it had its own branch so a 500 would
 * not fall through to "your pantry is empty". What it could not do was let a heart on a
 * match card be tapped: the list lived in `useState`, so the shared mutation layer had
 * nothing to paint and the cards were given no `onLike`.
 *
 * Signed-out readers never ask: the route is authenticated, and the component renders
 * nothing for them anyway.
 */
export function useMatches(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.matched(),
    enabled,
    queryFn: async ({ signal }) => {
      const response = await fetch('/api/recipes/match', { signal });
      if (!response.ok) throw new MatchFetchError();

      const data = (await response.json()) as Partial<MatchResults>;
      return {
        readyToCook: data.readyToCook ?? [],
        almostThere: data.almostThere ?? [],
        pantryItemsCount: data.pantryItemsCount ?? 0,
      } satisfies MatchResults;
    },
  });
}
