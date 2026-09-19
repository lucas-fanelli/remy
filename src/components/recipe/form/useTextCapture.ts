'use client';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  normaliseLine,
  parseIngredientLines,
  parseMethod,
  ParsedStep,
  serialiseIngredient,
  serialiseIngredients,
  serialiseSteps,
} from '@/lib/utils/recipeText';
import {
  createRowId,
  isBlankIngredientRow,
  isToTasteRow,
  normaliseIngredientRow,
} from './formValues';
import { IngredientRowInput, StepRowInput, StepRowValue } from './types';
import type { RecipeDraftText, RecipeDraftValues } from './useRecipeDraft';
import type { RecipeFormApi } from './useRecipeForm';

/**
 * The 'Write' tab's view over the form engine. ROWS stay the single source of truth for
 * validation, draft, preview and payload; the two texts are how the author writes them.
 *
 *   text -> rows   every change of a text is parsed at once and replaces that list. Steps
 *                  keep their id - and with it their photo - through `reconcileSteps`.
 *   rows -> text   a text is rewritten from its rows only when the rows no longer say what
 *                  the text says (they were edited by hand on the other tab, or the recipe
 *                  was loaded): `syncFromRows()` on entering 'Write'. Otherwise the author's
 *                  own wording is kept.
 *
 * Parsing is synchronous (a hundred short lines are cheap), so rows and text can not be
 * seen out of step by the draft, by Save on the 'Write' tab or by a tab switch.
 */

type TextCaptureForm = Pick<RecipeFormApi, 'values' | 'ingredients' | 'steps' | 'load'>;

export interface TextCaptureApi {
  ingredientsText: string;
  methodText: string;
  setIngredientsText(text: string): void;
  setMethodText(text: string): void;
  /** Row id -> why the parser was unsure about it; only rows that still exist */
  checks: Readonly<Record<string, string>>;
  checkCount: number;
  /** The author edited the row by hand: it is no longer the parser's guess */
  confirmRow(id: string): void;
  /** The text holds more lines / paragraphs than a recipe can have */
  ingredientsCapped: boolean;
  stepsCapped: boolean;
  /** Entering 'Write': rewrites the text of a list whose rows were edited since it was read */
  syncFromRows(): void;
  /** Draft restore: loads the values into the form and brings the wording back if it still fits */
  load(values: RecipeDraftValues, text?: RecipeDraftText): void;
  /** 'Start over': both texts empty (the shell resets the form) */
  clear(): void;
  /** What goes into the draft: texts that agree with the rows stored next to them */
  draftText: RecipeDraftText;
}

const comparable = (row: IngredientRowInput): string => {
  const normalised = normaliseIngredientRow(row);
  // 'to taste' chosen from the unit list and 'no amount, no unit' are the same row
  const unit = isToTasteRow(normalised) ? '' : normalised.unit;
  return JSON.stringify([normalised.amount, unit, normalised.name.trim()]);
};

/** True when parsing `text` gives exactly these rows (blank rows aside) */
export function ingredientsMatchText(rows: IngredientRowInput[], text: string): boolean {
  const parsed = parseIngredientLines(text).rows;
  const filled = rows.filter((row) => !isBlankIngredientRow(row));
  return (
    parsed.length === filled.length &&
    parsed.every((row, index) => comparable(row) === comparable(filled[index]))
  );
}

/** True when parsing `text` gives exactly these steps (steps without text aside) */
export function stepsMatchText(rows: { description: string }[], text: string): boolean {
  const parsed = parseMethod(text).steps;
  const written = rows.filter((row) => row.description.trim() !== '');
  return (
    parsed.length === written.length &&
    parsed.every((step, index) => step.description === written[index].description.trim())
  );
}

/** Row id -> the normalised text a photo-only row had when its paragraph went away */
export type OrphanTexts = ReadonlyMap<string, string>;

const NO_ORPHAN_TEXTS: OrphanTexts = new Map();

const hasText = (row: { description: string }): boolean => row.description.trim() !== '';

// One more kept paragraph always beats any number of kept photos (a recipe has 50 steps)
const SAME_TEXT = 1000;
const HAS_PHOTO = 1;

const photoOf = (row: { image: string }): number => (row.image !== '' ? HAS_PHOTO : 0);

/** Sorts row index `a` before `b` when it is nearer to the paragraph at `index` */
const distance = (a: number, b: number, index: number): number =>
  Math.abs(a - index) - Math.abs(b - index);

/**
 * Which paragraph is which row when the texts are equal: the longest run of equal texts IN
 * ORDER (what a diff does), so writing or deleting a paragraph above two equal ones never
 * swaps them. Between two runs of the same length the one that keeps more photos wins.
 * Returns paragraph index -> row index.
 */
function alignInOrder(
  wanted: string[],
  keys: (string | null)[],
  current: StepRowValue[]
): Map<number, number> {
  // A photo-only row nothing is remembered about has a null key and equals no paragraph
  const weight = (i: number, j: number): number =>
    keys[j] === wanted[i] ? SAME_TEXT + photoOf(current[j]) : 0;

  // best[i][j]: the best score for the paragraphs from i on against the rows from j on
  const best = Array.from({ length: wanted.length + 1 }, () =>
    new Array<number>(keys.length + 1).fill(0)
  );
  for (let i = wanted.length - 1; i >= 0; i -= 1) {
    for (let j = keys.length - 1; j >= 0; j -= 1) {
      const same = weight(i, j);
      best[i][j] = Math.max(
        best[i + 1][j],
        best[i][j + 1],
        same > 0 ? same + best[i + 1][j + 1] : 0
      );
    }
  }

  const pairs = new Map<number, number>();
  let i = 0;
  let j = 0;
  while (i < wanted.length && j < keys.length) {
    const same = weight(i, j);
    if (same > 0 && best[i][j] === same + best[i + 1][j + 1]) {
      pairs.set(i, j);
      i += 1;
      j += 1;
    } else if (best[i + 1][j] >= best[i][j + 1]) {
      i += 1;
    } else {
      j += 1;
    }
  }
  return pairs;
}

/**
 * The rows for freshly parsed paragraphs, keeping ids (and so photos) where it can:
 *   1. paragraphs whose text equals a row's text, in the same order, ARE those rows;
 *   2. a paragraph that MOVED (cut and pasted elsewhere) is the unclaimed row with its
 *      text - the one with a photo first, then the nearest;
 *   3. the others take the row at their own position, if that row still has text;
 *   4. a row with a photo that nothing claimed is kept at the end, photo intact and text
 *      empty - the validator then names it. A photo is never dropped and never handed to
 *      a paragraph it was not taken for.
 * A photo-only row made by rule 4 answers to the text it had (`orphanTexts`), so pasting
 * the paragraph back, or undoing its deletion, gives it its photo again.
 */
export function reconcileSteps(
  parsed: ParsedStep[],
  current: StepRowValue[],
  orphanTexts: OrphanTexts = NO_ORPHAN_TEXTS
): StepRowInput[] {
  const wanted = parsed.map((step) => normaliseLine(step.description));
  const keys = current.map((row) =>
    hasText(row) ? normaliseLine(row.description) : (orphanTexts.get(row.id) ?? null)
  );

  const rowOf = alignInOrder(wanted, keys, current);
  const used = new Set(rowOf.values());

  wanted.forEach((text, index) => {
    if (rowOf.has(index)) return;
    const [moved] = keys
      .map((_key, candidate) => candidate)
      .filter((candidate) => keys[candidate] === text && !used.has(candidate))
      .sort((a, b) => photoOf(current[b]) - photoOf(current[a]) || distance(a, b, index));
    if (moved === undefined) return;
    rowOf.set(index, moved);
    used.add(moved);
  });

  const rows = parsed.map((step, index): StepRowInput => {
    let from = rowOf.get(index);
    if (
      from === undefined &&
      index < current.length &&
      !used.has(index) &&
      hasText(current[index])
    ) {
      from = index;
      used.add(index);
    }
    return from === undefined
      ? { description: step.description, image: '' }
      : { id: current[from].id, description: step.description, image: current[from].image };
  });

  const orphans = current
    .filter((row, index) => !used.has(index) && row.image !== '')
    .map((row): StepRowInput => ({ id: row.id, description: '', image: row.image }));

  return [...rows, ...orphans];
}

/**
 * What the photo-only rows said before they lost their paragraph: kept for the rows that
 * are still photo-only, added for the rows `next` has just orphaned, forgotten otherwise.
 */
export function rememberOrphanTexts(
  known: OrphanTexts,
  current: StepRowValue[],
  next: StepRowInput[]
): Map<string, string> {
  const remembered = new Map<string, string>();
  const before = new Map(current.map((row) => [row.id, row]));
  next.forEach((row) => {
    const was = row.id === undefined ? undefined : before.get(row.id);
    if (!was || hasText(row)) return;
    const text = hasText(was) ? normaliseLine(was.description) : known.get(was.id);
    if (text !== undefined) remembered.set(was.id, text);
  });
  return remembered;
}

interface CaptureState {
  ingredientsText: string;
  methodText: string;
  checks: Record<string, string>;
  ingredientsCapped: boolean;
  stepsCapped: boolean;
}

export function useTextCapture(form: TextCaptureForm): TextCaptureApi {
  const { values } = form;

  // An existing recipe already is rows: its text is written from them. Create starts empty
  const [state, setState] = useState<CaptureState>(() => ({
    ingredientsText: serialiseIngredients(values.ingredients),
    methodText: serialiseSteps(values.steps),
    checks: {},
    ingredientsCapped: false,
    stepsCapped: false,
  }));

  const formRef = useRef(form);
  formRef.current = form;

  // Lines written FROM rows the author had settled: reading them back is not a new doubt
  const trustedLines = useRef(new Set<string>());

  const setIngredientsText = useCallback((text: string) => {
    const parsed = parseIngredientLines(text);
    const checks: Record<string, string> = {};
    const rows = parsed.rows.map((row) => {
      const id = createRowId();
      if (row.confidence === 'check' && !trustedLines.current.has(normaliseLine(row.sourceText))) {
        checks[id] = row.reason;
      }
      return { id, name: row.name, amount: row.amount, unit: row.unit };
    });

    setState((prev) => ({
      ...prev,
      ingredientsText: text,
      checks,
      ingredientsCapped: parsed.capped,
    }));
    formRef.current.ingredients.replaceAll(rows);
  }, []);

  // What a photo-only row said before its paragraph was cut or deleted. Client-side only: it
  // never reaches the engine, the draft or the payload
  const orphanTexts = useRef<OrphanTexts>(NO_ORPHAN_TEXTS);

  const setMethodText = useCallback((text: string) => {
    const parsed = parseMethod(text);
    setState((prev) => ({ ...prev, methodText: text, stepsCapped: parsed.capped }));

    // Bookkeeping on the rows as rendered, so the state update below stays a pure function
    const shown = formRef.current.values.steps;
    const known = orphanTexts.current;
    orphanTexts.current = rememberOrphanTexts(
      known,
      shown,
      reconcileSteps(parsed.steps, shown, known)
    );
    // Inside the state update, so a photo that lands meanwhile is carried over too
    formRef.current.steps.replaceAll((current) => reconcileSteps(parsed.steps, current, known));
  }, []);

  const confirmRow = useCallback((id: string) => {
    setState((prev) => {
      if (!(id in prev.checks)) return prev;
      const { [id]: _confirmed, ...checks } = prev.checks;
      return { ...prev, checks };
    });
  }, []);

  const ingredientsInSync = useMemo(
    () => ingredientsMatchText(values.ingredients, state.ingredientsText),
    [values.ingredients, state.ingredientsText]
  );
  const stepsInSync = useMemo(
    () => stepsMatchText(values.steps, state.methodText),
    [values.steps, state.methodText]
  );

  const draftText = useMemo<RecipeDraftText>(
    () => ({
      ingredients: ingredientsInSync
        ? state.ingredientsText
        : serialiseIngredients(values.ingredients),
      method: stepsInSync ? state.methodText : serialiseSteps(values.steps),
    }),
    [
      ingredientsInSync,
      stepsInSync,
      state.ingredientsText,
      state.methodText,
      values.ingredients,
      values.steps,
    ]
  );

  const latest = useRef({ draftText, ingredientsInSync, checks: state.checks });
  latest.current = { draftText, ingredientsInSync, checks: state.checks };

  const syncFromRows = useCallback(() => {
    const current = latest.current;
    if (!current.ingredientsInSync) {
      trustedLines.current = new Set(
        formRef.current.values.ingredients
          .filter((row) => !isBlankIngredientRow(row) && !(row.id in current.checks))
          .map((row) => normaliseLine(serialiseIngredient(row)))
      );
    }
    setState((prev) => ({
      ...prev,
      ingredientsText: current.draftText.ingredients,
      methodText: current.draftText.method,
      // The rewritten text is exactly the rows: nothing of it is beyond the limit
      ingredientsCapped: current.ingredientsInSync && prev.ingredientsCapped,
      stepsCapped: current.draftText.method === prev.methodText && prev.stepsCapped,
    }));
  }, []);

  const load = useCallback((draftValues: RecipeDraftValues, text?: RecipeDraftText) => {
    trustedLines.current = new Set();
    orphanTexts.current = NO_ORPHAN_TEXTS;
    const ingredients = draftValues.ingredients.map((row) => ({ ...row, id: createRowId() }));
    const keepIngredients =
      text !== undefined && ingredientsMatchText(draftValues.ingredients, text.ingredients);
    const keepMethod = text !== undefined && stepsMatchText(draftValues.steps, text.method);

    // The wording still fits the rows: read it again for what the parser was unsure about
    const checks: Record<string, string> = {};
    const parsed = keepIngredients ? parseIngredientLines(text.ingredients) : null;
    const filled = ingredients.filter((row) => !isBlankIngredientRow(row));
    parsed?.rows.forEach((row, index) => {
      if (row.confidence === 'check') checks[filled[index].id] = row.reason;
    });

    formRef.current.load({ ...draftValues, ingredients });
    setState({
      ingredientsText: keepIngredients
        ? text.ingredients
        : serialiseIngredients(draftValues.ingredients),
      methodText: keepMethod ? text.method : serialiseSteps(draftValues.steps),
      checks,
      ingredientsCapped: parsed?.capped ?? false,
      stepsCapped: keepMethod && parseMethod(text.method).capped,
    });
  }, []);

  const clear = useCallback(() => {
    trustedLines.current = new Set();
    orphanTexts.current = NO_ORPHAN_TEXTS;
    setState({
      ingredientsText: '',
      methodText: '',
      checks: {},
      ingredientsCapped: false,
      stepsCapped: false,
    });
  }, []);

  // A flag outlives its row when the row is removed on the other tab
  const checks = useMemo(() => {
    const alive = new Set(values.ingredients.map((row) => row.id));
    const entries = Object.entries(state.checks).filter(([id]) => alive.has(id));
    return entries.length === Object.keys(state.checks).length
      ? state.checks
      : Object.fromEntries(entries);
  }, [state.checks, values.ingredients]);

  return {
    ingredientsText: state.ingredientsText,
    methodText: state.methodText,
    setIngredientsText,
    setMethodText,
    checks,
    checkCount: Object.keys(checks).length,
    confirmRow,
    ingredientsCapped: state.ingredientsCapped,
    stepsCapped: state.stepsCapped,
    syncFromRows,
    load,
    clear,
    draftText,
  };
}
