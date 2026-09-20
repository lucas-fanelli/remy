'use client';
import { useCallback, useMemo, useRef } from 'react';
import { RecipeFieldPath } from './types';

/**
 * The S3 ref map: 'focus the first invalid control' after a failed Publish, and 'go to
 * this field' from FormStatus and the preview.
 *
 * Every editor takes an optional `registerField` prop and reports its controls under the
 * ENGINE's paths ('title', 'cookingTime', 'ingredients.<rowId>.amount',
 * 'steps.<rowId>.description', ...), so a shell needs three lines:
 *
 *   const { registerField, focusField } = useFieldRegistry();
 *   <TitleField form={form} registerField={registerField} />
 *   const issues = form.validate();
 *   if (issues[0]) { goTo(issues[0].section); focusField(issues[0].path); }
 */

/** A real element, or anything that can take focus (ImageUpload's imperative handle) */
export interface FocusableField {
  focus(): void;
  scrollIntoView?(options?: ScrollIntoViewOptions): void;
}

/** `null` unregisters the path (the control unmounted) */
export type RegisterField = (path: RecipeFieldPath, field: FocusableField | null) => void;

export interface FieldRegistry {
  /** Stable for the life of the shell: hand it to every editor */
  registerField: RegisterField;
  /**
   * Focuses the control registered for `path` and scrolls it to the centre. A path with
   * no control of its own falls back to its row, then to its list ('steps.<id>.image' ->
   * 'steps.<id>' -> 'steps'). When nothing is mounted yet (the shell is still switching
   * section) the request is kept for PENDING_FOCUS_MS and honoured as soon as the control
   * registers - no animation callback involved. Returns true when focus moved right away.
   */
  focusField(path: RecipeFieldPath): boolean;
}

/** How long a focus request waits for its control to mount */
export const PENDING_FOCUS_MS = 1000;

const resolveField = (
  fields: Map<RecipeFieldPath, FocusableField>,
  path: RecipeFieldPath
): FocusableField | null => {
  const parts = path.split('.');
  for (let length = parts.length; length > 0; length -= 1) {
    const field = fields.get(parts.slice(0, length).join('.'));
    if (field) return field;
  }
  return null;
};

const reveal = (field: FocusableField) => {
  field.focus();
  // Optional call: jsdom has no scrollIntoView
  field.scrollIntoView?.({ block: 'center' });
};

export function useFieldRegistry(): FieldRegistry {
  const fields = useRef(new Map<RecipeFieldPath, FocusableField>());
  const pending = useRef<{ path: RecipeFieldPath; until: number } | null>(null);

  const flushPending = useCallback(() => {
    const request = pending.current;
    if (!request) return;
    if (Date.now() > request.until) {
      pending.current = null;
      return;
    }
    const field = resolveField(fields.current, request.path);
    if (!field) return;
    pending.current = null;
    reveal(field);
  }, []);

  const registerField = useCallback<RegisterField>(
    (path, field) => {
      if (!field) {
        fields.current.delete(path);
        return;
      }
      fields.current.set(path, field);
      const request = pending.current;
      if (request && (request.path === path || request.path.startsWith(`${path}.`))) {
        // After the commit, so the most specific control of the new panel is registered too
        void Promise.resolve().then(flushPending);
      }
    },
    [flushPending]
  );

  const focusField = useCallback((path: RecipeFieldPath): boolean => {
    const field = resolveField(fields.current, path);
    if (field) {
      pending.current = null;
      reveal(field);
      return true;
    }
    pending.current = { path, until: Date.now() + PENDING_FOCUS_MS };
    return false;
  }, []);

  return useMemo(() => ({ registerField, focusField }), [registerField, focusField]);
}

/**
 * A stable callback ref that reports one control under `path`. Stable matters: a new
 * function on every render would unregister and re-register the control each time.
 */
export function useFieldRef<T extends FocusableField>(
  registerField: RegisterField | undefined,
  path: RecipeFieldPath
): (field: T | null) => void {
  return useCallback(
    (field: T | null) => {
      registerField?.(path, field);
    },
    [registerField, path]
  );
}
