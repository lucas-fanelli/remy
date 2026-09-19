import { CreateRecipeDTO } from '@/domain/types/recipe';
import { toNetworkSubmitError, toRecipeSubmitError } from '@/lib/errors/RecipeSubmitError';

/**
 * Shared hook for creating recipes — used by the one 'New recipe' editor
 * (RecipeTextFirstDialog). Returns a function that POSTs the recipe and calls the optional
 * onSuccess on completion; the editor itself navigates to the new recipe afterwards.
 *
 * Failures reject with a RecipeSubmitError: `message` is the server's text, `code` tells
 * the form which copy and recovery to show.
 */
export function useCreateRecipe(onSuccess?: () => void) {
  const createRecipe = async (data: CreateRecipeDTO) => {
    // The API schema is strict: the author comes from the session (userId is rejected),
    // and a step's image must be a Cloudinary URL or absent — the form keeps '' for
    // steps without a photo, so drop it here.
    const { userId: _userId, ...recipe } = data;
    const payload = {
      ...recipe,
      instructions: recipe.instructions.map(({ image, ...step }) =>
        image ? { ...step, image } : step
      ),
    };

    let response: Response;
    try {
      response = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      });
    } catch (error) {
      throw toNetworkSubmitError(error, 'Failed to create recipe');
    }

    if (!response.ok) {
      throw await toRecipeSubmitError(response, 'Failed to create recipe');
    }

    // No query invalidation: RecipeFeed uses direct fetch (not React Query), and the editor
    // leaves for the new recipe's page, which loads fresh.
    onSuccess?.();
    return response.json();
  };

  return createRecipe;
}
