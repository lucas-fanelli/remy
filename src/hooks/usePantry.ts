'use client';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useToast } from '@/contexts/ToastContext';
import { readBody } from '@/lib/api/readBody';
import { useApiErrorMessage } from '@/lib/api/translateApiError';
import { queryKeys } from '@/lib/query/keys';
import { useDeferredDelete } from './useDeferredDelete';

/** What GET /api/pantry sends for one ingredient — written from the route. */
export interface PantryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string | null;
  expiresAt: string | null;
  notes: string | null;
  addedAt: string;
}

/** What the add and edit forms send. */
export interface PantryItemInput {
  name: string;
  quantity: number;
  unit: string;
  category: string;
  notes: string | null;
}

/**
 * A pantry request that did not go through. `status` is null when nothing came back at all
 * (offline, a dropped connection); `body` is what the server said, for apiErrorMessage.
 */
export class PantryRequestError extends Error {
  constructor(
    readonly status: number | null,
    readonly body: unknown = null
  ) {
    super(`Pantry request failed (${status ?? 'network'})`);
    this.name = 'PantryRequestError';
  }
}

async function send(url: string, init: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
    });
  } catch {
    throw new PantryRequestError(null);
  }
  const body = await readBody(response);
  if (!response.ok) throw new PantryRequestError(response.status, body);
  return body;
}

/**
 * Something changed what is in a pantry from outside the pantry page — cooking a recipe
 * takes its ingredients out, undoing the cook puts them back — so every cached pantry and
 * the home page's matches are out of date.
 */
export function afterPantryChangedElsewhere(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.pantries() });
  void queryClient.invalidateQueries({ queryKey: queryKeys.matched() });
}

/**
 * The signed-in account's pantry, in the cache, and the three writes on it.
 *
 * It used to live in the page's own state, and every write — adding, editing, deleting —
 * re-read the whole list. While that read ran the page rendered nothing and then played
 * its entrance again, so each change looked like a reload of the page. Here a write
 * changes the one item it is about and nothing is re-read:
 *
 * - save (add or edit) waits for the server, whose answer is the item as stored, and puts
 *   that in the list. It waits because the server has the last word on duplicates (409),
 *   which the form turns into "modify the one you have?".
 * - remove takes the item out at once and offers Undo; the delete is sent when that has
 *   gone unanswered, and the item comes back if the server refuses it.
 *
 * Every write also marks the home page's matches stale: they are computed from the pantry.
 *
 * `ownerId` is who is signed in; nothing is read without one.
 */
export function usePantry(ownerId: string | undefined) {
  const queryClient = useQueryClient();
  const deferDelete = useDeferredDelete();
  const { showError } = useToast();
  const t = useTranslations('pantry');
  const apiErrorMessage = useApiErrorMessage();
  const key = queryKeys.pantry(ownerId ?? '');

  const query = useQuery({
    queryKey: key,
    enabled: Boolean(ownerId),
    queryFn: async ({ signal }): Promise<PantryItem[]> => {
      const response = await fetch('/api/pantry', { signal });
      if (!response.ok) throw new PantryRequestError(response.status, await readBody(response));
      const data = (await response.json()) as { pantry?: { items?: PantryItem[] } };
      return data.pantry?.items ?? [];
    },
  });

  const matchesChanged = () =>
    void queryClient.invalidateQueries({ queryKey: queryKeys.matched() });

  const save = useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: PantryItemInput }) => {
      const body = (await send(id ? `/api/pantry/${id}` : '/api/pantry', {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify(input),
      })) as { item: PantryItem };
      return body.item;
    },
    onSuccess: (item) => {
      // By id either way, so a read that already brought the new item in cannot list it twice.
      queryClient.setQueryData<PantryItem[]>(key, (items = []) => [
        ...items.filter((existing) => existing.id !== item.id),
        item,
      ]);
      matchesChanged();
    },
  });

  /**
   * Delete with Undo: the item leaves the list now and the delete is sent once the toast's
   * Undo has gone unanswered (lib/undo/deferredDeletes). A read while it waits cannot bring
   * it back — the deferred delete hides it again after each one.
   */
  const remove = (item: PantryItem) =>
    deferDelete({
      key: `pantry:${item.id}`,
      message: t('feedback.deleted'),
      hide: () =>
        queryClient.setQueryData<PantryItem[]>(key, (items) =>
          items?.filter((existing) => existing.id !== item.id)
        ),
      restore: () =>
        queryClient.setQueryData<PantryItem[]>(key, (items = []) =>
          items.some((existing) => existing.id === item.id) ? items : [...items, item]
        ),
      commit: async ({ keepalive }) => {
        await send(`/api/pantry/${item.id}`, { method: 'DELETE', keepalive });
      },
      onCommitted: matchesChanged,
      onFailed: (error) => {
        const failure = error instanceof PantryRequestError ? error : new PantryRequestError(null);
        showError(
          failure.status === null
            ? t('feedback.deleteOffline')
            : apiErrorMessage(failure.body, t('feedback.deleteFailed'))
        );
      },
    });

  return {
    query,
    items: query.data ?? [],
    save: save.mutateAsync,
    saving: save.isPending,
    remove,
  };
}
