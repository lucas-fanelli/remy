import { useQueryClient } from '@tanstack/react-query';
import { CreateRecipeDTO } from '@/domain/types/recipe';
import { toNetworkSubmitError, toRecipeSubmitError } from '@/lib/errors/RecipeSubmitError';
import { invalidateRecipeLists } from '@/lib/query/patchRecipeEverywhere';

/**
 * Shared hook for creating recipes — used by the one 'New recipe' editor
 * (RecipeTextFirstDialog). Returns a function that POSTs the recipe and calls the optional
 * onSuccess on completion; the editor itself navigates to the new recipe afterwards.
 *
 * Failures reject with a RecipeSubmitError: `message` is the server's text, `code` tells
 * the form which copy and recovery to show.
 *
 * The English fallback below is never read to the author: it is what `message` says for the
 * log when the API sent no sentence of its own, and RecipeSubmitError marks it `fromServer:
 * false` so the form prints its own translated copy instead (docs/I18N.md, API errors).
 */
export function useCreateRecipe(onSuccess?: () => void) {
  const queryClient = useQueryClient();

  const createRecipe = async (data: CreateRecipeDTO) => {
    // The API schema is strict: the author comes from the session (userId is rejected),
    // and a step's image must be a Cloudinary URL or absent. The editor's toPayload()
    // already leaves '' out; this keeps the promise for any other caller.
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

    // Every list that could show the new recipe is now out of date. This line used to say
    // there was nothing to invalidate because the feed fetched directly; once the lists
    // joined the cache that stopped being true, and going home within a minute of
    // publishing showed the feed without the recipe just published.
    void invalidateRecipeLists(queryClient);
    onSuccess?.();
    return response.json();
  };

  return createRecipe;
}
