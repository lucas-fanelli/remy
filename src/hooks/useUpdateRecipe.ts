import { useQueryClient } from '@tanstack/react-query';
import { Recipe, UpdateRecipeDTO } from '@/domain/types/recipe';
import { toNetworkSubmitError, toRecipeSubmitError } from '@/lib/errors/RecipeSubmitError';
import { queryKeys } from '@/lib/query/keys';
import { invalidateRecipeLists } from '@/lib/query/patchRecipeEverywhere';

export interface UpdateRecipeResponse {
  recipe: Recipe;
  message?: string;
}

/**
 * PUT /api/recipes/[id] has NO schema: the route casts the body to UpdateRecipeDTO and the
 * service only checks the fields it knows, so any extra key would be STORED. The body is
 * therefore rebuilt from the known fields only — a client-only row id can not get through.
 */
const toUpdateBody = (data: UpdateRecipeDTO): UpdateRecipeDTO => {
  const body: UpdateRecipeDTO = {};
  if (data.title !== undefined) body.title = data.title;
  if (data.description !== undefined) body.description = data.description;
  if (data.imageUrl !== undefined) body.imageUrl = data.imageUrl;
  if (data.cookingTime !== undefined) body.cookingTime = data.cookingTime;
  if (data.prepTime !== undefined) body.prepTime = data.prepTime;
  if (data.servings !== undefined) body.servings = data.servings;
  if (data.difficulty !== undefined) body.difficulty = data.difficulty;
  if (data.caption !== undefined) body.caption = data.caption;
  if (data.ingredients !== undefined) {
    body.ingredients = data.ingredients.map(({ name, amount, unit }) => ({ name, amount, unit }));
  }
  if (data.instructions !== undefined) {
    // Same rule as useCreateRecipe: a step without a photo carries no `image` key
    body.instructions = data.instructions.map(({ step, description, image }) =>
      image ? { step, description, image } : { step, description }
    );
  }
  return body;
};

/**
 * Shared hook for updating a recipe. Returns a function that PUTs the changes, calls
 * onSuccess with the updated recipe and resolves with the API's `{ recipe, message }`.
 * Failures reject with a RecipeSubmitError, mapped exactly as in useCreateRecipe.
 *
 * The English fallback below is never read to the author: it is what `message` says for the
 * log when the API sent no sentence of its own, and RecipeSubmitError marks it `fromServer:
 * false` so the form prints its own translated copy instead (docs/I18N.md, API errors).
 */
export function useUpdateRecipe(onSuccess?: (recipe: Recipe) => void) {
  const queryClient = useQueryClient();

  const updateRecipe = async (
    recipeId: string,
    data: UpdateRecipeDTO
  ): Promise<UpdateRecipeResponse> => {
    let response: Response;
    try {
      response = await fetch(`/api/recipes/${recipeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
        credentials: 'same-origin',
        body: JSON.stringify(toUpdateBody(data)),
      });
    } catch (error) {
      throw toNetworkSubmitError(error, 'Failed to update recipe');
    }

    if (!response.ok) {
      throw await toRecipeSubmitError(response, 'Failed to update recipe');
    }

    const result: UpdateRecipeResponse = await response.json();

    // Here rather than at each caller, so none can forget. The recipe's own page refetches
    // now — it is usually the screen that asked. Every list holding the old title, photo
    // or times refetches the next time it is shown; before, only that page heard.
    void queryClient.invalidateQueries({ queryKey: queryKeys.recipe(recipeId) });
    void invalidateRecipeLists(queryClient);
    onSuccess?.(result.recipe);
    return result;
  };

  return updateRecipe;
}
