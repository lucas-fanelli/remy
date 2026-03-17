'use client';

import { useQuery, keepPreviousData } from '@tanstack/react-query';

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

async function fetchRecipe(id: string): Promise<RecipeResponse> {
  const response = await fetch(`/api/recipes/${id}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Recipe not found');
    }
    throw new Error('Failed to load recipe');
  }

  return response.json();
}

export function useRecipe(id: string) {
  return useQuery({
    queryKey: ['recipe', id],
    queryFn: () => fetchRecipe(id),
    placeholderData: keepPreviousData, // Keep old recipe visible while loading new one
    enabled: !!id, // Only fetch if id is provided
    staleTime: 60 * 1000, // 1 minute
    select: (data) => data.recipe, // Return just the recipe object
  });
}

// Hook for like status
interface LikeStatusResponse {
  liked: boolean;
  likesCount: number;
}

async function fetchLikeStatus(
  recipeId: string,
  token: string | null
): Promise<LikeStatusResponse | null> {
  if (!token) return null;

  const response = await fetch(`/api/recipes/${recipeId}/like`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) return null;
  return response.json();
}

export function useRecipeLikeStatus(recipeId: string, token: string | null) {
  return useQuery({
    queryKey: ['recipe-like', recipeId, token],
    queryFn: () => fetchLikeStatus(recipeId, token),
    enabled: !!recipeId && !!token,
    staleTime: 30 * 1000, // 30 seconds
  });
}

// Hook for save status
interface SaveStatusResponse {
  saved: boolean;
}

async function fetchSaveStatus(
  recipeId: string,
  token: string | null
): Promise<SaveStatusResponse | null> {
  if (!token) return null;

  const response = await fetch(`/api/recipes/${recipeId}/save`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) return null;
  return response.json();
}

export function useRecipeSaveStatus(recipeId: string, token: string | null) {
  return useQuery({
    queryKey: ['recipe-save', recipeId, token],
    queryFn: () => fetchSaveStatus(recipeId, token),
    enabled: !!recipeId && !!token,
    staleTime: 30 * 1000, // 30 seconds
  });
}

export type { ApiRecipe, RecipeResponse };
