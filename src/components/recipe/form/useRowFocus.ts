'use client';
import { RefObject, useCallback, useEffect, useRef } from 'react';
import { focusRowField } from './keyboard';

/**
 * Focus hand-off for the list editors (S14): focus is never dropped when a row is added,
 * removed or moved. A row that is already in the DOM takes focus at once; a row that only
 * exists after the engine's next commit (just added, just moved) takes it in the effect
 * that follows that commit - never in an animation callback.
 */

interface RowFocusRequest {
  rowId: string;
  /** The `data-field` of the control inside the row */
  field: string;
  caretAtEnd: boolean;
}

export interface RowFocusOptions {
  /** Put the caret after the text (coming back to a Name with Backspace) */
  caretAtEnd?: boolean;
  /** Wait for the next commit even if the row is mounted: a moved row is re-inserted */
  afterCommit?: boolean;
}

const moveCaretToEnd = (element: Element | null) => {
  if (!(element instanceof HTMLInputElement) && !(element instanceof HTMLTextAreaElement)) return;
  const end = element.value.length;
  element.setSelectionRange(end, end);
};

export function useRowFocus(containerRef: RefObject<HTMLElement | null>) {
  const pending = useRef<RowFocusRequest | null>(null);

  const tryFocus = useCallback(
    (request: RowFocusRequest): boolean => {
      if (!focusRowField(containerRef.current, request.rowId, request.field)) return false;
      if (request.caretAtEnd) moveCaretToEnd(document.activeElement);
      return true;
    },
    [containerRef]
  );

  // No dependency list on purpose: the row a request points at arrives with SOME later
  // commit. One attempt only, so a request that cannot be met never steals focus later.
  useEffect(() => {
    const request = pending.current;
    if (!request) return;
    pending.current = null;
    tryFocus(request);
  });

  return useCallback(
    (rowId: string, field: string, options: RowFocusOptions = {}) => {
      const request = { rowId, field, caretAtEnd: Boolean(options.caretAtEnd) };
      if (!options.afterCommit && tryFocus(request)) return;
      pending.current = request;
    },
    [tryFocus]
  );
}
