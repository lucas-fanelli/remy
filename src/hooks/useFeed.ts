'use client';
import { useInfiniteQuery } from '@tanstack/react-query';
import { text } from '@/i18n/text';
import { queryKeys, type FeedFilters } from '@/lib/query/keys';
import type { Recipe, ViewerState } from '@/domain/types/recipe';

export const FEED_PAGE_SIZE = 12;

/**
 * How far the feed will go before it stops asking.
 *
 * 25 pages is 300 recipes. The cap is not about the server — it is about a list that grows
 * until the tab runs out of memory, which is what an IntersectionObserver with no ceiling
 * eventually does.
 */
export const FEED_MAX_PAGES = 25;

export interface FeedRecipe extends Recipe {
  likeCount: number;
  commentCount: number;
  viewer: ViewerState | null;
}

export interface FeedPage {
  recipes: FeedRecipe[];
  hasMore?: boolean;
}

export class FeedFetchError extends Error {
  constructor(readonly body: unknown) {
    super('Failed to load recipes');
    this.name = 'FeedFetchError';
  }
}

/** The descriptor the feed prints when a page will not load. */
export const FEED_LOAD_FAILED = text('feed.states.loadFailed');

function queryString(filters: FeedFilters, offset: number): string {
  const params = new URLSearchParams({
    limit: String(FEED_PAGE_SIZE),
    offset: String(offset),
  });

  if (filters.difficulty !== 'all') params.append('difficulty', filters.difficulty);
  // The three time filters are two different parameters, which is why this is a ladder
  // rather than a lookup.
  if (filters.time === 'under30') params.append('maxTime', '30');
  else if (filters.time === 'under60') params.append('maxTime', '60');
  else if (filters.time === 'over60') params.append('minTime', '60');
  if (filters.sort !== 'newest') params.append('sort', filters.sort);

  return params.toString();
}

/**
 * The feed, in the cache instead of in `useState`.
 *
 * What this deletes is as interesting as what it adds. The old read carried an
 * AbortController and a monotonic `requestIdRef`, described in its own comment as a
 * "double-guard against filter change races" — the abort cancelled in-flight requests and
 * the id discarded any stale response that arrived before the abort took effect. Both exist
 * because the filters and the list were separate pieces of state that had to be kept in
 * agreement by hand.
 *
 * With the filters IN the key, a filter change is a different query. React Query cancels
 * the old one through the signal it passes in, and a late answer lands in the cache entry
 * it belongs to rather than overwriting the current one. There is nothing left to guard.
 *
 * The `existingIds` de-duplication goes too: pages are separate entries here, so a recipe
 * cannot be appended to a list that already holds it.
 *
 * What does NOT come for free, and is kept by hand in the component: the page ceiling, the
 * observer's 500px margin, and the guard against the observer firing twice in one frame.
 */
export function useFeed(filters: FeedFilters) {
  return useInfiniteQuery({
    queryKey: queryKeys.feed(filters),
    initialPageParam: 0,

    queryFn: async ({ pageParam, signal }) => {
      const response = await fetch(`/api/recipes?${queryString(filters, pageParam)}`, { signal });

      if (!response.ok) {
        let body: unknown = null;
        try {
          body = await response.json();
        } catch {
          // A non-JSON error body must not become a network error; the status decides.
        }
        throw new FeedFetchError(body);
      }

      return response.json() as Promise<FeedPage>;
    },

    getNextPageParam: (lastPage, allPages) => {
      // The endpoint answers `hasMore` but has not always; a full page is the fallback
      // signal the old code used and it stays the fallback here.
      const more = lastPage.hasMore ?? lastPage.recipes.length === FEED_PAGE_SIZE;
      if (!more || allPages.length >= FEED_MAX_PAGES) return undefined;
      return allPages.length * FEED_PAGE_SIZE;
    },
  });
}
