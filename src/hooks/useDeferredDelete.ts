'use client';
import { useTranslations } from 'next-intl';
import { useCallback, useSyncExternalStore } from 'react';
import { useToast } from '@/contexts/ToastContext';
import {
  UNDO_WINDOW_MS,
  deferDelete,
  deletesVersion,
  isHidden,
  isWaiting,
  sendWaitingDelete,
  subscribeToDeletes,
  undoDelete,
  type DeferredDelete,
} from '@/lib/undo/deferredDeletes';

export interface UndoableDelete extends Omit<DeferredDelete, 'onSettled'> {
  /** What the toast says was deleted: "Eliminamos el ingrediente". */
  message: string;
}

/**
 * Delete something with "Deshacer": it leaves the screen now, the toast offers Undo for
 * UNDO_WINDOW_MS, and the delete is sent when that time is up or the toast is closed. See
 * lib/undo/deferredDeletes for why it waits instead of deleting and restoring.
 */
export function useDeferredDelete(): (entry: UndoableDelete) => void {
  const { showToast, dismissToast } = useToast();
  const tCommon = useTranslations('common');

  return useCallback(
    ({ message, ...entry }: UndoableDelete) => {
      let toastId: string | null = null;

      deferDelete({
        ...entry,
        // Sent early (another delete, the page going away) or undone: the toast goes too.
        onSettled: () => {
          if (toastId) dismissToast(toastId);
        },
      });

      toastId = showToast(message, 'success', {
        duration: UNDO_WINDOW_MS,
        action: { label: tCommon('actions.undo'), onClick: () => undoDelete(entry.key) },
        // Timed out or closed by the reader: that is the answer, so send it now.
        onDismiss: () => {
          if (isWaiting(entry.key)) sendWaitingDelete();
        },
      });
    },
    [showToast, dismissToast, tCommon]
  );
}

/**
 * Whether something is off the screen because its delete is waiting or on its way — for
 * screens that keep a list in their own state rather than in the query cache, which the
 * deletes cannot reach. Re-renders the caller when that changes.
 */
export function useHiddenByDelete(): (key: string) => boolean {
  // The version is only there to re-render on a change; isHidden is read fresh each time.
  useSyncExternalStore(subscribeToDeletes, deletesVersion, deletesVersion);
  return isHidden;
}
