'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useTextDescriptor } from '@/i18n/text';
import { readBody } from '@/lib/api/readBody';
import { useApiErrorMessage } from '@/lib/api/translateApiError';
import { VIEWER_SPECS, type Engagement, type ViewerSpec } from '@/lib/engagement/specs';
import { patchRecipeEverywhere, readEngagement } from '@/lib/query/patchRecipeEverywhere';

/**
 * One implementation of "toggle a viewer flag and tell the truth about it".
 *
 * What the reader asked for, in their words: the result should show instantly regardless
 * of the server, and if there is no connection it should say so and take the like back.
 * That is what this does, for saving exactly as much as for liking — the two were
 * previously an optimistic-with-rollback handler on the feed, a wait-for-the-server
 * handler on the recipe page, and two swallowed rejections.
 */

/** A rejection that carries the server's body, so the toast can use its error code. */
export class ViewerMutationError extends Error {
  constructor(
    readonly body: unknown,
    readonly offline: boolean
  ) {
    super(offline ? 'Offline' : 'Request rejected');
    this.name = 'ViewerMutationError';
  }
}

/** Thrown to abandon a toggle before it starts; never surfaced. */
class Abort extends Error {}

export interface ViewerToggle {
  /**
   * Fire and forget.
   *
   * `next` defaults to the opposite of what the CACHE says, not of what the component
   * rendered. Those can differ — a second tab, a stale prop — and the cache is the single
   * truth now, which is also what makes a double tap land on one answer instead of racing.
   */
  toggle: (recipeId: string, next?: boolean) => void;
  isPending: (recipeId: string) => boolean;
}

function useViewerMutation<T>(spec: ViewerSpec<T>): ViewerToggle {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { showError, showInfo, showSuccess } = useToast();
  const renderText = useTextDescriptor();
  const apiErrorMessage = useApiErrorMessage();

  const mutation = useMutation({
    mutationKey: ['viewer', spec.key],

    mutationFn: async ({ recipeId, next }: { recipeId: string; next: boolean }) => {
      let response: Response;
      try {
        response = await fetch(spec.url(recipeId), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
          body: JSON.stringify(spec.body(next)),
        });
      } catch {
        // A thrown fetch is the network, not the server. It is the case the reader named
        // and it gets its own sentence rather than the generic failure.
        throw new ViewerMutationError(null, true);
      }

      const body = await readBody(response);
      if (!response.ok) throw new ViewerMutationError(body, false);
      return body as T;
    },

    onMutate: ({ recipeId, next }) => {
      if (!user) {
        showInfo(renderText(spec.text.signedOut));
        throw new Abort();
      }

      // Paint first. This is the whole point, and it is why there is no `isLoading` gate
      // on the control any more: waiting for a round trip to fill a heart is the thing
      // being removed.
      const undo = patchRecipeEverywhere(queryClient, recipeId, (engagement: Engagement) =>
        spec.optimistic(engagement, next)
      );

      return { undo };
    },

    onError: (error, _variables, context) => {
      if (error instanceof Abort) return;

      context?.undo();

      showError(
        error instanceof ViewerMutationError && error.offline
          ? renderText(spec.text.offline)
          : apiErrorMessage(
              error instanceof ViewerMutationError ? error.body : null,
              renderText(spec.text.failed)
            )
      );
    },

    onSuccess: (data, { recipeId, next }) => {
      patchRecipeEverywhere(queryClient, recipeId, (engagement: Engagement) =>
        spec.settle(engagement, data)
      );
      showSuccess(renderText(next ? spec.text.on : spec.text.off));
    },

    // No `onSettled` invalidate, deliberately. The recipe page records why: a refetch
    // after the write handed back the pre-click answer inside its own window, and the
    // heart visibly undid itself. The server's answer is written in directly instead.
  });

  const toggle = useCallback(
    (recipeId: string, next?: boolean) => {
      // From WHICHEVER cache holds it, not just the detail page's. Reading only
      // `['recipe', id]` found nothing for a recipe in the feed's pages, assumed the flag
      // was false and therefore sent `{ liked: true }` for a recipe the reader had already
      // liked — deleting the like while filling the heart in. The feed's own regression
      // test, written for exactly that bug in PR #7, caught it here.
      const engagement = readEngagement(queryClient, recipeId);
      const current = engagement ? spec.read(engagement) : false;

      mutation.mutate({ recipeId, next: next ?? !current });
    },
    [mutation, queryClient, spec]
  );

  const isPending = useCallback(
    (recipeId: string) =>
      mutation.isPending &&
      (mutation.variables as { recipeId?: string } | undefined)?.recipeId === recipeId,
    [mutation.isPending, mutation.variables]
  );

  return { toggle, isPending };
}

export const useLike = (): ViewerToggle => useViewerMutation(VIEWER_SPECS.like);
export const useSave = (): ViewerToggle => useViewerMutation(VIEWER_SPECS.save);
