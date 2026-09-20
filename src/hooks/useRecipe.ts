'use client';

import { useQuery } from '@tanstack/react-query';
import { text, type TextDescriptor } from '@/i18n/text';

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
  likesCount?: number;
  commentsCount?: number;
  averageRating?: number;
  totalRatings?: number;
  hasMadeCount?: number;
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

// Hook for like status
interface LikeStatusResponse {
  liked: boolean;
  likesCount: number;
}

async function fetchLikeStatus(recipeId: string): Promise<LikeStatusResponse | null> {
  const response = await fetch(`/api/recipes/${recipeId}/like`);

  if (!response.ok) return null;
  return response.json();
}

export function useRecipeLikeStatus(recipeId: string, userId: string | null) {
  return useQuery({
    queryKey: ['recipe-like', recipeId, userId],
    queryFn: () => fetchLikeStatus(recipeId),
    enabled: !!recipeId && !!userId,
    staleTime: 30 * 1000, // 30 seconds
  });
}

// Hook for save status
interface SaveStatusResponse {
  saved: boolean;
}

async function fetchSaveStatus(recipeId: string): Promise<SaveStatusResponse | null> {
  const response = await fetch(`/api/recipes/${recipeId}/save`);

  if (!response.ok) return null;
  return response.json();
}

export function useRecipeSaveStatus(recipeId: string, userId: string | null) {
  return useQuery({
    queryKey: ['recipe-save', recipeId, userId],
    queryFn: () => fetchSaveStatus(recipeId),
    enabled: !!recipeId && !!userId,
    staleTime: 30 * 1000, // 30 seconds
  });
}

export type { ApiRecipe, RecipeResponse };
