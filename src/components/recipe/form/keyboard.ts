import type { KeyboardEvent as ReactKeyboardEvent } from 'react';

/**
 * Key handling shared by the recipe form (S3 ENTER RULE, S6, S7).
 *
 * Nothing in the form relies on a submit event: Enter in a single-line field moves to the
 * next field and NEVER publishes (an accidental publish burns one of the daily slots).
 *
 * Row convention used by `focusRowField`: the row container carries `data-row-id={row.id}`
 * and each control `data-field='amount' | 'unit' | 'name' | 'description'` (on the input
 * itself or on any wrapper around it).
 */

type KeyLike = Pick<
  ReactKeyboardEvent | KeyboardEvent,
  'key' | 'shiftKey' | 'ctrlKey' | 'metaKey' | 'altKey'
> & {
  isComposing?: boolean;
  nativeEvent?: { isComposing?: boolean };
};

// Enter that confirms an IME composition is not a command
const isComposing = (event: KeyLike): boolean =>
  Boolean(event.isComposing ?? event.nativeEvent?.isComposing);

/** Enter on its own: no modifier, not part of an IME composition */
export const isPlainEnter = (event: KeyLike): boolean =>
  event.key === 'Enter' &&
  !event.shiftKey &&
  !event.ctrlKey &&
  !event.metaKey &&
  !event.altKey &&
  !isComposing(event);

/** Ctrl+Enter / Cmd+Enter: 'add the next step' inside a step's textarea */
export const isModEnter = (event: KeyLike): boolean =>
  event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !isComposing(event);

/** Backspace in a control that is already empty: 'remove this empty row' */
export const isBackspaceOnEmpty = (event: KeyLike & { target: EventTarget | null }): boolean => {
  const target = event.target as Partial<HTMLInputElement> | null;
  return (
    event.key === 'Backspace' &&
    !event.shiftKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    !isComposing(event) &&
    target?.value === ''
  );
};

const FIELD_SELECTOR = 'input, textarea, select, [data-form-field]';

const isFocusableField = (element: HTMLElement): boolean => {
  if (element.matches(':disabled')) return false;
  if (element instanceof HTMLInputElement && ['hidden', 'file'].includes(element.type)) {
    return false;
  }
  if (element.tabIndex < 0) return false;
  // MUI keeps helper inputs in the DOM (the multiline shadow textarea, Select's native input)
  return element.closest('[aria-hidden="true"], [hidden]') === null;
};

/** The fields of `scope` a keyboard user can land on, in DOM (= tab) order */
export function getFormFields(scope: ParentNode): HTMLElement[] {
  return Array.from(scope.querySelectorAll<HTMLElement>(FIELD_SELECTOR)).filter(isFocusableField);
}

/**
 * `onKeyDown` for single-line fields: plain Enter moves focus to the next field of the
 * same <form> (or of the document). Returns true when it handled the key.
 *
 * It stands aside for a textarea (Enter is a newline), for an open combobox (Enter picks
 * the highlighted option) and for an event somebody already handled.
 */
export function focusNextField(event: ReactKeyboardEvent<HTMLElement>): boolean {
  if (!isPlainEnter(event) || event.defaultPrevented) return false;
  const target = event.target as HTMLElement;
  if (target instanceof HTMLTextAreaElement) return false;
  if (target.getAttribute('aria-expanded') === 'true') return false;

  // Handled even on the last field: Enter must never fall through to a submit
  event.preventDefault();

  const fields = getFormFields(target.closest('form') ?? target.ownerDocument);
  const index = fields.indexOf(target);
  if (index !== -1) fields[index + 1]?.focus();
  return true;
}

/**
 * Focuses the `field` control of the row `rowId` inside `container`; false when the row
 * is not in the DOM (yet). Call it from an effect after adding / removing / moving a row.
 */
export function focusRowField(
  container: ParentNode | null | undefined,
  rowId: string,
  field: string
): boolean {
  if (!container) return false;
  const row = Array.from(container.querySelectorAll<HTMLElement>('[data-row-id]')).find(
    (element) => element.dataset.rowId === rowId
  );
  const marked = row?.querySelector<HTMLElement>(`[data-field="${field}"]`);
  if (!marked) return false;
  const control = marked.matches('input, textarea, select, button, [tabindex]')
    ? marked
    : marked.querySelector<HTMLElement>('input, textarea, select');
  if (!control) return false;
  control.focus();
  return true;
}

/** The row that takes focus when `id` is removed: the next one, else the previous, else null */
export function neighbourRowId<T extends { id: string }>(rows: T[], id: string): string | null {
  const index = rows.findIndex((row) => row.id === id);
  if (index === -1) return null;
  return (rows[index + 1] ?? rows[index - 1])?.id ?? null;
}
