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

/**
 * The rows for freshly parsed paragraphs, keeping ids (and so photos) where it can:
 *   1. a paragraph whose text equals a row's text IS that row, wherever it moved;
 *   2. the others take the row at their own position, if that row still has text;
 *   3. a row with a photo that nothing claimed is kept at the end, photo intact and text
 *      empty - the validator then names it. A photo is never dropped and never handed to
 *      a paragraph it was not taken for.
 */
export function reconcileSteps(parsed: ParsedStep[], current: StepRowValue[]): StepRowInput[] {
  const used = new Set<string>();
  const claim = (row: StepRowValue, description: string): StepRowInput => {
    used.add(row.id);
    return { id: row.id, description, image: row.image };
  };
  const hasText = (row: StepRowValue) => row.description.trim() !== '';

  const byText = parsed.map((step) => {
    const wanted = normaliseLine(step.description);
    const match = current.find(
      (row) => !used.has(row.id) && hasText(row) && normaliseLine(row.description) === wanted
    );
    return match ? claim(match, step.description) : null;
  });

  const rows = byText.map((row, index): StepRowInput => {
    if (row) return row;
    const candidate = current[index];
    return candidate && !used.has(candidate.id) && hasText(candidate)
      ? claim(candidate, parsed[index].description)
      : { description: parsed[index].description, image: '' };
  });

  const orphans = current
    .filter((row) => !used.has(row.id) && row.image !== '')
    .map((row): StepRowInput => ({ id: row.id, description: '', image: row.image }));

  return [...rows, ...orphans];
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

  const setMethodText = useCallback((text: string) => {
    const parsed = parseMethod(text);
    setState((prev) => ({ ...prev, methodText: text, stepsCapped: parsed.capped }));
    // Inside the state update, so a photo that lands meanwhile is carried over too
    formRef.current.steps.replaceAll((current) => reconcileSteps(parsed.steps, current));
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
