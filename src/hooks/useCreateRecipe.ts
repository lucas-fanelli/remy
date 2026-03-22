import { CreateRecipeDTO } from '@/domain/types/recipe';

/**
 * Shared hook for creating recipes — used by both home page and navigation.
 * Returns a function that POSTs the recipe and calls onSuccess on completion.
 * Feed refresh is handled by the onSuccess callback (e.g., Navigation calls loadRecipes(true)).
 */
export function useCreateRecipe(onSuccess?: () => void) {
  const createRecipe = async (data: CreateRecipeDTO) => {
    const response = await fetch('/api/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
      credentials: 'same-origin',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create recipe');
    }

    // Feed refresh is handled by the onSuccess callback — RecipeFeed uses
    // direct fetch (not React Query), so no query invalidation is needed.
    onSuccess?.();
    return response.json();
  };

  return createRecipe;
}
