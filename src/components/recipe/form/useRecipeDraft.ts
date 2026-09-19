'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { isCloudinaryUrl } from '@/lib/utils/cloudinary';
import { isBlankIngredientRow, isBlankStepRow, trimTrailingBlankRows } from './formValues';
import { NumericFieldValue, RECIPE_FORM_SECTIONS, RecipeFormValuesInput } from './types';

/**
 * Autosaved draft of the recipe being created.
 *
 * Stored as `{ v: 1, savedAt, section, values }` under one key per user. Only strings,
 * numbers and final Cloudinary URLs are written: row ids, File objects and blob: URLs
 * never reach storage. Every storage access is wrapped in try/catch (private windows,
 * blocked site data, a full quota) and whatever is read goes through a type guard, so a
 * draft written by another build of the form can be ignored but can never crash this one.
 *
 * Autosave only ever WRITES. A blank form is never taken for 'the author emptied it' - a
 * form that was re-initialised in place looks exactly the same - so the stored draft is
 * removed by `clearDraft()` ('Start over', Publish) and by logout, and by nothing else.
 *
 * A draft belongs to ONE user. When the key changes under a form that stays mounted (a
 * logout, the next login), what is on screen was written under the old key: it is never
 * saved under the new one until somebody edits it.
 */

export const RECIPE_DRAFT_VERSION = 1;
export const RECIPE_DRAFT_KEY_PREFIX = 'remy:recipe-draft:v1:';
export const RECIPE_DRAFT_DEBOUNCE_MS = 500;

export const recipeDraftKey = (userId: string): string => `${RECIPE_DRAFT_KEY_PREFIX}${userId}`;

export type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Form values without row ids */
export type RecipeDraftValues = Omit<RecipeFormValuesInput, 'ingredients' | 'steps'> & {
  ingredients: { name: string; amount: string; unit: string }[];
  steps: { description: string; image: string }[];
};

/**
 * The author's own wording, for an editor whose primary input is free text (one ingredient
 * per line, one step per paragraph). Optional and additive: an editor that does not know it
 * ignores the key, and a draft without it is still a valid draft.
 */
export interface RecipeDraftText {
  ingredients: string;
  method: string;
}

export interface RecipeDraft {
  v: typeof RECIPE_DRAFT_VERSION;
  /** Epoch milliseconds */
  savedAt: number;
  section: string;
  values: RecipeDraftValues;
  text?: RecipeDraftText;
}

const DIFFICULTIES = ['easy', 'medium', 'hard'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === 'string';

const isNumericField = (value: unknown): value is NumericFieldValue =>
  value === '' || (typeof value === 'number' && Number.isFinite(value));

// An image that is not a finished upload (a blob: preview, a foreign URL) is not kept
const safeImage = (url: string): string => (isCloudinaryUrl(url) ? url : '');

/** Strips ids, client-only keys, unfinished images and trailing blank rows */
export function toDraftValues(values: RecipeFormValuesInput): RecipeDraftValues {
  return {
    title: values.title,
    description: values.description,
    imageUrl: safeImage(values.imageUrl),
    caption: values.caption,
    prepTime: values.prepTime,
    cookingTime: values.cookingTime,
    servings: values.servings,
    difficulty: values.difficulty,
    ingredients: trimTrailingBlankRows(values.ingredients, isBlankIngredientRow).map(
      ({ name, amount, unit }) => ({ name, amount, unit })
    ),
    steps: trimTrailingBlankRows(
      values.steps.map(({ description, image }) => ({ description, image: safeImage(image) })),
      isBlankStepRow
    ),
  };
}

/** Nothing worth keeping: servings and difficulty are prefilled, so they do not count */
export function isBlankDraft(values: RecipeDraftValues): boolean {
  return (
    values.title.trim() === '' &&
    values.description.trim() === '' &&
    values.imageUrl === '' &&
    values.caption.trim() === '' &&
    values.prepTime === '' &&
    values.cookingTime === '' &&
    values.ingredients.length === 0 &&
    values.steps.length === 0
  );
}

const parseValues = (input: unknown): RecipeDraftValues | null => {
  if (!isRecord(input)) return null;
  const { title, description, imageUrl, caption, prepTime, cookingTime, servings, difficulty } =
    input;
  if (!isString(title) || !isString(description) || !isString(imageUrl) || !isString(caption)) {
    return null;
  }
  if (!isNumericField(prepTime) || !isNumericField(cookingTime) || !isNumericField(servings)) {
    return null;
  }
  if (!isString(difficulty) || !DIFFICULTIES.includes(difficulty)) return null;
  if (!Array.isArray(input.ingredients) || !Array.isArray(input.steps)) return null;

  const ingredients: RecipeDraftValues['ingredients'] = [];
  for (const row of input.ingredients) {
    if (!isRecord(row) || !isString(row.name) || !isString(row.amount) || !isString(row.unit)) {
      return null;
    }
    ingredients.push({ name: row.name, amount: row.amount, unit: row.unit });
  }

  const steps: RecipeDraftValues['steps'] = [];
  for (const row of input.steps) {
    if (!isRecord(row) || !isString(row.description) || !isString(row.image)) return null;
    steps.push({ description: row.description, image: row.image });
  }

  // Rebuilt through toDraftValues so unknown keys are gone and the key order is canonical
  return toDraftValues({
    title,
    description,
    imageUrl,
    caption,
    prepTime,
    cookingTime,
    servings,
    difficulty: difficulty as RecipeDraftValues['difficulty'],
    ingredients,
    steps,
  });
};

const parseText = (input: unknown): RecipeDraftText | undefined =>
  isRecord(input) && isString(input.ingredients) && isString(input.method)
    ? { ingredients: input.ingredients, method: input.method }
    : undefined;

/** What is compared to tell whether storage is up to date: the values and, if any, the text */
const snapshotOf = (values: RecipeDraftValues, text: RecipeDraftText | undefined): string =>
  JSON.stringify(text ? [values, text.ingredients, text.method] : values);

/**
 * Type guard + normaliser for whatever was found in storage. Returns null for anything
 * that is not a v1 draft with the expected shapes; an unknown `section` falls back to the
 * first one.
 */
export function parseRecipeDraft(
  raw: string | null | undefined,
  sections: readonly string[] = RECIPE_FORM_SECTIONS
): RecipeDraft | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(data) || data.v !== RECIPE_DRAFT_VERSION) return null;
  if (typeof data.savedAt !== 'number' || !Number.isFinite(data.savedAt)) return null;

  const values = parseValues(data.values);
  if (!values || isBlankDraft(values)) return null;

  const section =
    isString(data.section) && sections.includes(data.section) ? data.section : sections[0];
  const draft: RecipeDraft = { v: RECIPE_DRAFT_VERSION, savedAt: data.savedAt, section, values };
  const text = parseText(data.text);
  return text ? { ...draft, text } : draft;
}

/** window.localStorage, or null where it is missing or throws on access */
export function getDefaultDraftStorage(): DraftStorage | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function readRecipeDraft(
  key: string,
  storage: DraftStorage | null = getDefaultDraftStorage(),
  sections?: readonly string[]
): RecipeDraft | null {
  try {
    return storage ? parseRecipeDraft(storage.getItem(key), sections) : null;
  } catch {
    return null;
  }
}

/** Returns false when the write failed (the caller may then warn before unload) */
export function writeRecipeDraft(
  key: string,
  draft: RecipeDraft,
  storage: DraftStorage | null = getDefaultDraftStorage()
): boolean {
  try {
    if (!storage) return false;
    storage.setItem(key, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

/** Also the logout hook-in: `clearRecipeDraft(recipeDraftKey(user.id))` */
export function clearRecipeDraft(
  key: string,
  storage: DraftStorage | null = getDefaultDraftStorage()
): boolean {
  try {
    if (!storage) return false;
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export interface UseRecipeDraftOptions {
  /** The draft is per user; without a user the hook is inert */
  userId: string | null | undefined;
  /** The live form values (`form.values`) */
  values: RecipeFormValuesInput;
  /**
   * The string `useRecipeForm` gets as its `resetKey`. A change means the form was
   * re-initialised in place (a dialog that stays mounted was closed or reopened): the
   * autosave still pending for the old form is written first, storage is read again into
   * `draft` and 'Draft saved' is forgotten. An editor that unmounts on close may omit it.
   */
  resetKey?: string;
  /** Where the author is, stored along so a restore can return there */
  section?: string;
  /** The free text the rows were written as, stored along with them (see RecipeDraftText) */
  text?: RecipeDraftText;
  /** False pauses autosave (Edit has no stored draft). Default true */
  enabled?: boolean;
  /** Section vocabulary of this build; an unknown stored section falls back to the first */
  sections?: readonly string[];
  /** Injectable storage; defaults to window.localStorage. null disables persistence */
  storage?: DraftStorage | null;
  /** Injectable key; defaults to `recipeDraftKey(userId)` */
  storageKey?: string;
  debounceMs?: number;
  /** Injectable clock for `savedAt` */
  now?: () => number;
}

export interface UseRecipeDraftResult {
  /** The draft found in storage when the hook mounted (or the key / resetKey changed), if any */
  draft: RecipeDraft | null;
  /** Time of the last successful write in this session ('Draft saved') */
  savedAt: number | null;
  /** The last write threw or there is no storage: warn before unload while dirty */
  saveFailed: boolean;
  /** Writes a pending autosave now (the hook also does it on unmount) */
  flush(): void;
  /** Removes the stored draft and cancels a pending write: after Publish and 'Start over' */
  clearDraft(): void;
}

export function useRecipeDraft({
  userId,
  values,
  resetKey,
  section = RECIPE_FORM_SECTIONS[0],
  text,
  enabled = true,
  sections = RECIPE_FORM_SECTIONS,
  storage,
  storageKey,
  debounceMs = RECIPE_DRAFT_DEBOUNCE_MS,
  now = Date.now,
}: UseRecipeDraftOptions): UseRecipeDraftResult {
  const key = storageKey ?? (userId ? recipeDraftKey(userId) : null);
  // One form of one user: storage is read again whenever either half changes
  const identity = JSON.stringify([key, resetKey]);

  // Latest props for the callbacks; the default storage is resolved on every access so a
  // window that appears after the first render (hydration) is still picked up
  const latestRef = useRef({ key, now, storage, values, text });
  latestRef.current = { key, now, storage, values, text };
  const resolveStorage = (): DraftStorage | null => {
    const injected = latestRef.current.storage;
    return injected === undefined ? getDefaultDraftStorage() : injected;
  };

  const readDraft = () => ({
    identity,
    key,
    draft: key ? readRecipeDraft(key, resolveStorage(), sections) : null,
  });

  const [found, setFound] = useState(readDraft);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);

  // What storage holds and what the form held when the hook mounted. A write happens only
  // once the author changed something: opening the form never refreshes `savedAt`.
  const storedSnapshotRef = useRef<string | null>(null);
  // Where the stored draft says the author was. Once the author has MOVED (a shell that
  // never passes the restored section must not cause a write), moving is worth a write
  const storedSectionRef = useRef<string | null>(null);
  const mountSectionRef = useRef(section);
  const movedSinceMountRef = useRef(false);
  const mountSnapshotRef = useRef<string | null>(null);
  const changedSinceMountRef = useRef(false);
  // Values that are never saved as they stand: what was on screen when the draft was cleared
  // (published), and what was on screen when the KEY changed - that is the work of whoever
  // held the old key, not something the new user wrote
  const clearedSnapshotRef = useRef<string | null>(null);

  const pendingRef = useRef<{
    values: RecipeFormValuesInput;
    section: string;
    text?: RecipeDraftText;
  } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelTimer = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // `notify: false` touches no state, so it is safe while rendering and while unmounting
  const writePending = useCallback((notify: boolean) => {
    const pending = pendingRef.current;
    const { key: currentKey, now: clock } = latestRef.current;
    pendingRef.current = null;
    cancelTimer();
    if (!pending || !currentKey) return;

    const draftValues = toDraftValues(pending.values);
    const time = clock();
    const draft: RecipeDraft = {
      v: RECIPE_DRAFT_VERSION,
      savedAt: time,
      section: pending.section,
      values: draftValues,
    };
    const written = writeRecipeDraft(
      currentKey,
      pending.text ? { ...draft, text: pending.text } : draft,
      resolveStorage()
    );
    if (written) {
      storedSnapshotRef.current = snapshotOf(draftValues, pending.text);
      storedSectionRef.current = pending.section;
    }
    if (notify) {
      setSaveFailed(!written);
      if (written) setSavedAt(time);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reads refs only
  }, []);

  let current = found;
  // False on the first render: `found` was read with this very key
  const keyChanged = found.key !== key;
  if (found.identity !== identity) {
    if (!keyChanged) {
      // Same user, new form: what was typed inside the debounce window belongs to the form
      // that is going away and is written BEFORE storage is read again
      writePending(false);
    } else {
      // Another user, or logout (which clears the draft): never written back
      pendingRef.current = null;
      cancelTimer();
    }
    current = readDraft();
    setFound(current);
    setSavedAt(null);
    setSaveFailed(false);
  }

  const trackedIdentityRef = useRef<string | null>(null);
  if (trackedIdentityRef.current !== identity) {
    trackedIdentityRef.current = identity;
    storedSnapshotRef.current = current.draft
      ? snapshotOf(current.draft.values, current.draft.text)
      : null;
    storedSectionRef.current = current.draft ? current.draft.section : null;
    mountSectionRef.current = section;
    movedSinceMountRef.current = false;
    mountSnapshotRef.current = snapshotOf(toDraftValues(values), text);
    changedSinceMountRef.current = false;
    // A closed editor that stays mounted through a logout and the next login still holds the
    // last author's recipe: under the new key it waits for a real edit before it is saved
    clearedSnapshotRef.current = keyChanged ? mountSnapshotRef.current : null;
  }

  useEffect(() => {
    pendingRef.current = null;
    if (!enabled || !key) return undefined;

    const draftValues = toDraftValues(values);
    const snapshot = snapshotOf(draftValues, text);
    if (snapshot !== mountSnapshotRef.current) changedSinceMountRef.current = true;
    if (snapshot !== clearedSnapshotRef.current) clearedSnapshotRef.current = null;

    const stored = storedSnapshotRef.current;
    if (section !== mountSectionRef.current) movedSinceMountRef.current = true;
    const sameSection = !movedSinceMountRef.current || section === storedSectionRef.current;
    const upToDate = snapshot === stored && sameSection;
    // Never written and never a reason to delete: a form that was reset in place (dialog
    // closed, 'Start over') is just as blank as one the author emptied by hand
    const blank = isBlankDraft(draftValues);
    const awaitingRestore = stored !== null && !changedSinceMountRef.current;
    const justCleared = snapshot === clearedSnapshotRef.current;
    if (upToDate || blank || awaitingRestore || justCleared) return undefined;

    pendingRef.current = { values, section, text };
    timerRef.current = setTimeout(() => writePending(true), debounceMs);
    return cancelTimer;
    // The text is compared by content: callers build the object on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, section, text?.ingredients, text?.method, enabled, key, debounceMs, writePending]);

  // Closing the editor inside the debounce window must not lose the last keystrokes
  useEffect(() => () => writePending(false), [writePending]);

  const flush = useCallback(() => writePending(true), [writePending]);

  const clearDraft = useCallback(() => {
    pendingRef.current = null;
    cancelTimer();
    const { key: currentKey, values: currentValues, text: currentText } = latestRef.current;
    clearedSnapshotRef.current = snapshotOf(toDraftValues(currentValues), currentText);
    if (currentKey && clearRecipeDraft(currentKey, resolveStorage())) {
      storedSnapshotRef.current = null;
    }
    setFound((prev) => (prev.draft ? { ...prev, draft: null } : prev));
    setSavedAt(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reads refs only
  }, []);

  return { draft: current.draft, savedAt, saveFailed, flush, clearDraft };
}

/**
 * `beforeunload` prompt while `active`. S11: use it only while the form is dirty AND
 * (the last draft write failed OR the form is editing an existing recipe).
 */
export function useUnsavedChangesWarning(active: boolean): void {
  useEffect(() => {
    if (!active) return undefined;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Chrome still needs returnValue to be set
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [active]);
}
