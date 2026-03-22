'use client';

import { useQuery } from '@tanstack/react-query';

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
