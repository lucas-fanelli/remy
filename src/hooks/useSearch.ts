'use client';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/keys';
import type { ViewerState } from '@/domain/types/recipe';

/**
 * What `/api/search` sends for an account. No id: key a list of these by username.
 */
export interface SearchUser {
  username: string;
  fullName?: string | null;
  avatar?: string;
  /**
   * Private accounts are found too: one nobody can find is one nobody can ask to follow.
   * Optional because it only draws the lock — a row without it reads as public, and that
   * costs nothing, since the profile the row opens decides what this reader may see.
   */
  isPrivate?: boolean;
}

/** What `/api/search` sends for a recipe — written off the route, not remembered. */
export interface SearchRecipe {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  difficulty: string;
  prepTime: number;
  cookingTime: number;
  /** `null` for a recipe that never recorded it; the route stopped inventing `4`. */
  servings: number | null;
  userId: string;
  likeCount: number;
  commentCount: number;
  averageRating?: number;
  totalRatings?: number;
  viewer: ViewerState | null;
  author: { username: string; avatar?: string };
}

export interface SearchResults {
  users: SearchUser[];
  recipes: SearchRecipe[];
}

export class SearchFetchError extends Error {
  constructor() {
    super('Search failed');
    this.name = 'SearchFetchError';
  }
}

/**
 * One search, in the cache, keyed by what was searched for.
 *
 * The bug this removes, reproduced before fixing it: the old read fetched inside an effect
 * on `[query]` with no AbortController and no stale-response check. Searching "tostadas"
 * (slow) and then "empanadas" (fast) left the URL saying `empanadas` while the page showed
 * five Tostadas — the slow answer arrived last and overwrote the one the reader wanted.
 *
 * With the query IN the key, the two searches are two cache entries. The slow answer lands
 * in the "tostadas" entry, the page is reading the "empanadas" one, and there is nothing to
 * guard. React Query also cancels the superseded request through the signal.
 *
 * Going back to a search you already ran is instant, too, for as long as the cache holds it.
 */
export function useSearch(query: string) {
  return useQuery({
    queryKey: queryKeys.search(query),
    enabled: query.length > 0,
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal });
      if (!response.ok) throw new SearchFetchError();

      const data = (await response.json()) as Partial<SearchResults>;
      return { users: data.users ?? [], recipes: data.recipes ?? [] } satisfies SearchResults;
    },
  });
}
