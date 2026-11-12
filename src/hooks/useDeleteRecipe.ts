'use client';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { useToast } from '@/contexts/ToastContext';
import { readBody } from '@/lib/api/readBody';
import { useApiErrorMessage } from '@/lib/api/translateApiError';
import { removeRecipeEverywhere, restoreRecipeEverywhere } from '@/lib/query/patchRecipeEverywhere';
import { useDeferredDelete } from './useDeferredDelete';

class RecipeDeleteError extends Error {
  constructor(readonly body: unknown) {
    super('Recipe delete failed');
    this.name = 'RecipeDeleteError';
  }
}

/**
 * Delete a recipe, already confirmed, with Undo.
 *
 * The one way to delete a recipe, for the feed's card menu and the recipe's own page alike.
 * Both asked first and still do — a recipe is the one thing Lucas kept the "¿Seguro?" for —
 * and then waited for the server with the dialog open. Now the recipe leaves every list at
 * once and the delete is sent when the toast's Undo has gone unanswered. Waiting rather
 * than restoring is what makes Undo possible at all here: deleting a recipe deletes its
 * photo and its comments, and nothing could put those back (lib/undo/deferredDeletes).
 */
export function useDeleteRecipe(): (recipeId: string) => void {
  const queryClient = useQueryClient();
  const deferDelete = useDeferredDelete();
  const { showError } = useToast();
  const t = useTranslations('recipe');
  const apiErrorMessage = useApiErrorMessage();

  return useCallback(
    (recipeId: string) =>
      deferDelete({
        key: `recipe:${recipeId}`,
        message: t('toasts.deleted'),
        hide: () => removeRecipeEverywhere(queryClient, recipeId),
        restore: () => void restoreRecipeEverywhere(queryClient),
        commit: async ({ keepalive }) => {
          const response = await fetch(`/api/recipes/${recipeId}`, {
            method: 'DELETE',
            headers: { 'X-Requested-With': 'fetch' },
            keepalive,
          });
          if (!response.ok) throw new RecipeDeleteError(await readBody(response));
        },
        onFailed: (error) =>
          showError(
            error instanceof RecipeDeleteError
              ? apiErrorMessage(error.body, t('toasts.deleteFailed'))
              : t('toasts.deleteOffline')
          ),
      }),
    [queryClient, deferDelete, showError, t, apiErrorMessage]
  );
}
