'use client';

import { useQuery } from '@tanstack/react-query';
import { text, type TextDescriptor } from '@/i18n/text';
import type { RatingBreakdown, ViewerState } from '@/domain/types/recipe';

// API Recipe type - matches what the API actually returns
// This is more complete than the domain Recipe type
interface ApiRecipe {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  additionalImages?: string[];
  difficulty: string;
  prepTime: number;
  cookingTime: number;
  servings: number;
  cuisine?: string;
  ingredients: Array<{
    name: string;
    amount: string;
    unit: string;
    notes?: string;
  }>;
  instructions: Array<{
    step: number;
    description: string;
    image?: string;
  }>;
  caption?: string;
  userId: string;
  user?: {
    id: string;
    username: string;
    fullName: string | null;
    avatar: string | null;
  };
  author?: {
    username: string;
    fullName?: string;
    avatar?: string;
  };
  likeCount: number;
  commentCount: number;
  averageRating?: number;
  totalRatings?: number;
  /** How many people gave each score. Counts only — rating is anonymous. */
  ratingBreakdown?: RatingBreakdown;
  hasMadeCount?: number;
  /**
   * What this reader did to this recipe; null when signed out. Required, not optional:
   * the page used to ask two extra endpoints for it after first paint, so the heart and
   * the bookmark rendered empty and then flipped once the answers arrived.
   */
  viewer: ViewerState | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

interface RecipeResponse {
  recipe: ApiRecipe;
}

/**
 * What the recipe page prints when the fetch fails.
 *
 * The English `message` is kept - it is what a log, a Sentry breadcrumb or a caller holding
 * a plain Error sees - and the descriptor is what the page renders, in the reader's
 * language. This function has no locale and no hooks, so it cannot translate anything
 * itself (see the descriptor pattern in docs/I18N.md).
 */
export class RecipeFetchError extends Error {
  constructor(
    readonly descriptor: TextDescriptor,
    message: string
  ) {
    super(message);
    this.name = 'RecipeFetchError';
  }
}

async function fetchRecipe(id: string): Promise<RecipeResponse> {
  const response = await fetch(`/api/recipes/${id}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new RecipeFetchError(text('recipe.states.notFound'), 'Recipe not found');
    }
    throw new RecipeFetchError(text('recipe.states.loadFailed'), 'Failed to load recipe');
  }

  return response.json();
}

const selectRecipe = (data: RecipeResponse) => data.recipe;

export function useRecipe(id: string) {
  return useQuery({
    queryKey: ['recipe', id],
    queryFn: () => fetchRecipe(id),
    enabled: !!id, // Only fetch if id is provided
    staleTime: 5 * 60 * 1000, // 5 minutes
    select: selectRecipe,
  });
}

// `useRecipeLikeStatus` and `useRecipeSaveStatus` used to live here: two extra requests,
// each with its own cache key and its own 30-second staleness, asking the server what the
// recipe response should have said in the first place. They are gone — read
// `recipe.viewer` instead, which arrives with the recipe and cannot disagree with it.

export type { ApiRecipe, RecipeResponse };
