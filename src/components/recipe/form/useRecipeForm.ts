'use client';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Recipe } from '@/domain/types/recipe';
import { RECIPE_LIMITS, UNIT_TO_TASTE } from '@/lib/constants';
import {
  createEmptyValues,
  createIngredientRow,
  createStepRow,
  hydrateValues,
  isBlankIngredientRow,
  normaliseIngredientRow,
  snapshotValues,
  trimTrailingBlankRows,
  valuesFromRecipe,
  withTrailingBlankIngredient,
} from './formValues';
import { toPayload as buildPayload } from './toPayload';
import {
  IngredientRowInput,
  IngredientRowValue,
  RecipeFieldPath,
  RecipeFormErrors,
  RecipeFormMode,
  RecipeFormSection,
  RecipeFormTouched,
  RecipeFormValues,
  RecipeFormValuesInput,
  RecipeIssue,
  RecipePayload,
  RecipeScalarField,
  SectionStatus,
  StepRowInput,
  StepRowValue,
} from './types';
import { deriveSectionStatus, isPathWithin, validateRecipe } from './validateRecipe';

/**
 * ONE form engine for Create and Edit.
 *
 * Every mutator is a functional state update addressed by field name or by a client-only
 * row id, and every mutator keeps its identity for the life of the component. An async
 * callback captured in an old render (ImageUpload's onChange resolving seconds later) can
 * therefore never overwrite what was typed meanwhile, and a URL that arrives for a row
 * that was removed is simply dropped.
 */

export interface UseRecipeFormOptions {
  /** The recipe being edited; leave it out (or null) to create one */
  initial?: Recipe | null;
  /**
   * The form re-initialises when this string changes, never on `initial`'s identity:
   * `recipe.id + ':' + open` in dialogs, `recipe.id` on a route, any constant for Create.
   * A shell that stays mounted gives the same string to `useRecipeDraft`.
   */
  resetKey: string;
}

export type IngredientPatch = Partial<Omit<IngredientRowValue, 'id'>>;
export type StepPatch = Partial<Omit<StepRowValue, 'id'>>;

export interface IngredientListApi {
  /** False once the list holds RECIPE_LIMITS.ingredients filled rows */
  canAdd: boolean;
  /**
   * Adds a blank row after `afterId` (or at the end) and returns its id so the caller can
   * focus it; null when the list is full. Appending replaces the trailing blank row, so
   * exactly one trailing blank row exists at any time.
   */
  add(afterId?: string): string | null;
  remove(id: string): void;
  /** Choosing 'to taste' clears the amount; typing an amount on a 'to taste' row clears the unit */
  update(id: string, patch: IngredientPatch): void;
  /** Undo of `remove`: puts the row back at `index` with its original id */
  restore(row: IngredientRowValue, index: number): void;
  replaceAll(rows: IngredientRowInput[]): void;
}

export interface StepListApi {
  /** False once the list holds RECIPE_LIMITS.steps rows */
  canAdd: boolean;
  /** Adds a blank step after `afterId` (or at the end) and returns its id; null when full */
  add(afterId?: string): string | null;
  remove(id: string): void;
  update(id: string, patch: StepPatch): void;
  move(id: string, direction: -1 | 1): void;
  restore(row: StepRowValue, index: number): void;
  replaceAll(rows: StepRowInput[]): void;
}

export interface RecipeFormApi {
  mode: RecipeFormMode;
  values: RecipeFormValues;
  /** VISIBLE errors by path: shown on first blur, re-checked on change while in error */
  errors: RecipeFormErrors;
  touched: RecipeFormTouched;
  publishAttempted: boolean;
  /** Every current problem, visible or not (FormStatus' 'Missing: ...' reads this) */
  issues: RecipeIssue[];
  sectionStatus: Record<RecipeFormSection, SectionStatus>;
  isDirty: boolean;
  uploadsInFlight: number;
  setField<K extends RecipeScalarField>(path: K, value: RecipeFormValues[K]): void;
  /**
   * Call on blur with a field path, or with 'ingredients.<rowId>' when focus leaves an
   * ingredient ROW (that also normalises the amount and fills in 'units').
   */
  touch(path: RecipeFieldPath): void;
  ingredients: IngredientListApi;
  steps: StepListApi;
  /** Key by field path: 'imageUrl', 'steps.<rowId>'. Removing a row releases its key */
  setUploading(key: string, busy: boolean): void;
  /** Publish / Save: shows every error and returns them in the author's order ([] = valid) */
  validate(): RecipeIssue[];
  toPayload(): RecipePayload;
  /** Replaces the values (draft restore): rows without an id get one, errors are cleared */
  load(values: RecipeFormValuesInput): void;
  /** Back to `initial` (or to an empty form) */
  reset(): void;
}

interface FormState {
  resetKey: string;
  values: RecipeFormValues;
  initialSnapshot: string;
  errors: RecipeFormErrors;
  touched: RecipeFormTouched;
  publishAttempted: boolean;
  uploading: Record<string, true>;
}

const createState = (initial: Recipe | null | undefined, resetKey: string): FormState => {
  const values = initial ? valuesFromRecipe(initial) : createEmptyValues();
  return {
    resetKey,
    values,
    initialSnapshot: snapshotValues(values),
    errors: {},
    touched: {},
    publishAttempted: false,
    uploading: {},
  };
};

/** First message per path, for the paths `show` lets through */
const collectErrors = (
  issues: RecipeIssue[],
  show: (path: RecipeFieldPath) => boolean
): RecipeFormErrors => {
  const errors: RecipeFormErrors = {};
  issues.forEach((issue) => {
    if (!(issue.path in errors) && show(issue.path)) errors[issue.path] = issue.message;
  });
  return errors;
};

/** Drops 'ingredients.<id>...' / 'steps.<id>...' keys whose row no longer exists */
const dropDeadRowKeys = <T>(record: Record<string, T>, values: RecipeFormValues) => {
  const isAlive = (key: string): boolean => {
    const [list, id] = key.split('.');
    if ((list !== 'ingredients' && list !== 'steps') || id === undefined) return true;
    return values[list].some((row) => row.id === id);
  };
  const keys = Object.keys(record);
  if (keys.every(isAlive)) return record;
  const next: Record<string, T> = {};
  keys.filter(isAlive).forEach((key) => {
    next[key] = record[key];
  });
  return next;
};

/** New values in: errors already on screen are re-checked, no new error appears */
const commitValues = (state: FormState, values: RecipeFormValues): FormState => {
  if (values === state.values) return state;
  const hasErrors = Object.keys(state.errors).length > 0;
  return {
    ...state,
    values,
    errors: hasErrors
      ? collectErrors(validateRecipe(values), (path) => path in state.errors)
      : state.errors,
    touched: dropDeadRowKeys(state.touched, values),
    uploading: dropDeadRowKeys(state.uploading, values),
  };
};

const insertIngredient = (
  rows: IngredientRowValue[],
  row: IngredientRowValue,
  afterId?: string
): IngredientRowValue[] => {
  const filled = trimTrailingBlankRows(rows, isBlankIngredientRow);
  if (filled.length >= RECIPE_LIMITS.ingredients) return rows;
  const index = afterId === undefined ? -1 : filled.findIndex((item) => item.id === afterId);
  // At the end the new row REPLACES the trailing blank one, so there is never a second
  if (index === -1 || index === filled.length - 1) return [...filled, row];
  return [...rows.slice(0, index + 1), row, ...rows.slice(index + 1)];
};

const insertAt = <T extends { id: string }>(rows: T[], row: T, index: number): T[] => {
  if (rows.some((item) => item.id === row.id)) return rows;
  const position = Math.max(0, Math.min(index, rows.length));
  return [...rows.slice(0, position), row, ...rows.slice(position)];
};

const patchIngredient = (row: IngredientRowValue, patch: IngredientPatch): IngredientRowValue => {
  const next = { ...row, ...patch, id: row.id };
  if (patch.unit === UNIT_TO_TASTE) {
    next.amount = '';
  } else if (
    patch.amount !== undefined &&
    patch.amount.trim() !== '' &&
    next.unit === UNIT_TO_TASTE
  ) {
    next.unit = '';
  }
  return next;
};

export function useRecipeForm({ initial, resetKey }: UseRecipeFormOptions): RecipeFormApi {
  const [storedState, setState] = useState<FormState>(() => createState(initial, resetKey));

  // Reset is keyed on `resetKey`, during render, so no frame ever shows the old recipe
  let state = storedState;
  if (storedState.resetKey !== resetKey) {
    state = createState(initial, resetKey);
    setState(state);
  }

  // Latest props / state for the callbacks that must READ (never for writing)
  const initialRef = useRef(initial);
  initialRef.current = initial;
  const stateRef = useRef(state);
  stateRef.current = state;

  const mode: RecipeFormMode = initial ? 'edit' : 'create';
  const { values, errors, touched, publishAttempted, uploading, initialSnapshot } = state;

  const applyValues = useCallback((update: (values: RecipeFormValues) => RecipeFormValues) => {
    setState((prev) => commitValues(prev, update(prev.values)));
  }, []);

  const setField = useCallback(
    <K extends RecipeScalarField>(path: K, value: RecipeFormValues[K]) => {
      applyValues((prev) => (prev[path] === value ? prev : { ...prev, [path]: value }));
    },
    [applyValues]
  );

  const touch = useCallback((path: RecipeFieldPath) => {
    setState((prev) => {
      const [list, rowId] = path.split('.');
      const ingredients =
        list === 'ingredients' && rowId !== undefined
          ? prev.values.ingredients.map((row) =>
              row.id === rowId ? normaliseIngredientRow(row) : row
            )
          : prev.values.ingredients;
      const changed = ingredients.some((row, index) => row !== prev.values.ingredients[index]);
      const nextValues = changed ? { ...prev.values, ingredients } : prev.values;

      return {
        ...prev,
        values: nextValues,
        touched: prev.touched[path] ? prev.touched : { ...prev.touched, [path]: true },
        errors: collectErrors(
          validateRecipe(nextValues),
          (issuePath) => issuePath in prev.errors || isPathWithin(issuePath, path)
        ),
      };
    });
  }, []);

  const ingredientMutators = useMemo(
    () => ({
      add: (afterId?: string): string | null => {
        const current = stateRef.current.values.ingredients;
        const filled = trimTrailingBlankRows(current, isBlankIngredientRow);
        if (filled.length >= RECIPE_LIMITS.ingredients) return null;
        const row = createIngredientRow();
        applyValues((prev) => ({
          ...prev,
          ingredients: insertIngredient(prev.ingredients, row, afterId),
        }));
        return row.id;
      },
      remove: (id: string) => {
        applyValues((prev) =>
          prev.ingredients.some((row) => row.id === id)
            ? {
                ...prev,
                ingredients: withTrailingBlankIngredient(
                  prev.ingredients.filter((row) => row.id !== id)
                ),
              }
            : prev
        );
      },
      update: (id: string, patch: IngredientPatch) => {
        applyValues((prev) =>
          prev.ingredients.some((row) => row.id === id)
            ? {
                ...prev,
                ingredients: withTrailingBlankIngredient(
                  prev.ingredients.map((row) => (row.id === id ? patchIngredient(row, patch) : row))
                ),
              }
            : prev
        );
      },
      restore: (row: IngredientRowValue, index: number) => {
        applyValues((prev) => {
          const filled = trimTrailingBlankRows(prev.ingredients, isBlankIngredientRow);
          if (filled.length >= RECIPE_LIMITS.ingredients) return prev;
          const ingredients = insertAt(prev.ingredients, row, index);
          return ingredients === prev.ingredients
            ? prev
            : { ...prev, ingredients: withTrailingBlankIngredient(ingredients) };
        });
      },
      replaceAll: (rows: IngredientRowInput[]) => {
        applyValues((prev) => ({
          ...prev,
          ingredients: withTrailingBlankIngredient(rows.map((row) => createIngredientRow(row))),
        }));
      },
    }),
    [applyValues]
  );

  const stepMutators = useMemo(
    () => ({
      add: (afterId?: string): string | null => {
        if (stateRef.current.values.steps.length >= RECIPE_LIMITS.steps) return null;
        const row = createStepRow();
        applyValues((prev) => {
          if (prev.steps.length >= RECIPE_LIMITS.steps) return prev;
          const index = afterId === undefined ? -1 : prev.steps.findIndex((s) => s.id === afterId);
          return {
            ...prev,
            steps: insertAt(prev.steps, row, index === -1 ? prev.steps.length : index + 1),
          };
        });
        return row.id;
      },
      remove: (id: string) => {
        applyValues((prev) =>
          prev.steps.some((row) => row.id === id)
            ? { ...prev, steps: prev.steps.filter((row) => row.id !== id) }
            : prev
        );
      },
      update: (id: string, patch: StepPatch) => {
        applyValues((prev) =>
          prev.steps.some((row) => row.id === id)
            ? {
                ...prev,
                steps: prev.steps.map((row) => (row.id === id ? { ...row, ...patch, id } : row)),
              }
            : prev
        );
      },
      move: (id: string, direction: -1 | 1) => {
        applyValues((prev) => {
          const from = prev.steps.findIndex((row) => row.id === id);
          const to = from + direction;
          if (from === -1 || to < 0 || to >= prev.steps.length) return prev;
          const steps = [...prev.steps];
          [steps[from], steps[to]] = [steps[to], steps[from]];
          return { ...prev, steps };
        });
      },
      restore: (row: StepRowValue, index: number) => {
        applyValues((prev) => {
          if (prev.steps.length >= RECIPE_LIMITS.steps) return prev;
          const steps = insertAt(prev.steps, row, index);
          return steps === prev.steps ? prev : { ...prev, steps };
        });
      },
      replaceAll: (rows: StepRowInput[]) => {
        applyValues((prev) => ({ ...prev, steps: rows.map((row) => createStepRow(row)) }));
      },
    }),
    [applyValues]
  );

  const setUploading = useCallback((key: string, busy: boolean) => {
    setState((prev) => {
      if (busy === Boolean(prev.uploading[key])) return prev;
      const next = { ...prev.uploading };
      if (busy) next[key] = true;
      else delete next[key];
      return { ...prev, uploading: next };
    });
  }, []);

  const validate = useCallback((): RecipeIssue[] => {
    setState((prev) => ({
      ...prev,
      publishAttempted: true,
      errors: collectErrors(validateRecipe(prev.values), () => true),
    }));
    return validateRecipe(stateRef.current.values);
  }, []);

  const toPayload = useCallback((): RecipePayload => buildPayload(values, mode), [values, mode]);

  const load = useCallback((next: RecipeFormValuesInput) => {
    setState((prev) => ({
      ...prev,
      values: hydrateValues(next),
      errors: {},
      touched: {},
      publishAttempted: false,
      uploading: {},
    }));
  }, []);

  const reset = useCallback(() => {
    setState((prev) => createState(initialRef.current, prev.resetKey));
  }, []);

  const issues = useMemo(() => validateRecipe(values), [values]);
  const sectionStatus = useMemo(
    () => deriveSectionStatus(issues, touched, publishAttempted, values),
    [issues, touched, publishAttempted, values]
  );
  const isDirty = useMemo(
    () => snapshotValues(values) !== initialSnapshot,
    [values, initialSnapshot]
  );

  const filledIngredients = trimTrailingBlankRows(values.ingredients, isBlankIngredientRow).length;
  const canAddIngredient = filledIngredients < RECIPE_LIMITS.ingredients;
  const canAddStep = values.steps.length < RECIPE_LIMITS.steps;

  const ingredients = useMemo<IngredientListApi>(
    () => ({ canAdd: canAddIngredient, ...ingredientMutators }),
    [canAddIngredient, ingredientMutators]
  );
  const steps = useMemo<StepListApi>(
    () => ({ canAdd: canAddStep, ...stepMutators }),
    [canAddStep, stepMutators]
  );

  return {
    mode,
    values,
    errors,
    touched,
    publishAttempted,
    issues,
    sectionStatus,
    isDirty,
    uploadsInFlight: Object.keys(uploading).length,
    setField,
    touch,
    ingredients,
    steps,
    setUploading,
    validate,
    toPayload,
    load,
    reset,
  };
}
