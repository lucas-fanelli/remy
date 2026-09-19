import { Recipe } from '@/domain/types/recipe';
import { RECIPE_DEFAULT_UNIT, RECIPE_LIMITS, UNIT_TO_TASTE } from '@/lib/constants';
import { normaliseAmount } from '@/lib/utils/normaliseAmount';
import {
  IngredientRowInput,
  IngredientRowValue,
  RecipeFormValues,
  RecipeFormValuesInput,
  StepRowInput,
  StepRowValue,
} from './types';

/** The only prefilled number (S5); times are deliberately left empty */
export const DEFAULT_SERVINGS = 4;

let rowCounter = 0;

/**
 * Client-only row id. `crypto.randomUUID` when the runtime has it (jsdom and insecure
 * contexts do not), otherwise a module counter. Ids are never persisted or sent.
 */
export function createRowId(): string {
  const cryptoApi: Crypto | undefined = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }
  rowCounter += 1;
  return `row-${rowCounter}`;
}

export const createIngredientRow = (row: Partial<IngredientRowInput> = {}): IngredientRowValue => ({
  id: row.id || createRowId(),
  name: row.name ?? '',
  amount: row.amount ?? '',
  unit: row.unit ?? '',
});

export const createStepRow = (row: Partial<StepRowInput> = {}): StepRowValue => ({
  id: row.id || createRowId(),
  description: row.description ?? '',
  image: row.image ?? '',
});

export const isBlankIngredientRow = (row: IngredientRowInput): boolean =>
  row.name.trim() === '' && row.amount.trim() === '' && row.unit.trim() === '';

/** A step with a photo is NOT blank: an uploaded photo must never vanish silently */
export const isBlankStepRow = (row: StepRowInput): boolean =>
  row.description.trim() === '' && row.image === '';

/**
 * The one 'to taste' model (Pantry's): a named row with no amount and either no unit or
 * the explicit 'to taste' unit. It serialises as `{ amount: '', unit: UNIT_TO_TASTE }`.
 */
export const isToTasteRow = (row: IngredientRowInput): boolean =>
  row.name.trim() !== '' &&
  row.amount.trim() === '' &&
  (row.unit.trim() === '' || row.unit === UNIT_TO_TASTE);

/** Rows without their TRAILING blank ones; interior blanks are kept */
export function trimTrailingBlankRows<T>(rows: T[], isBlank: (row: T) => boolean): T[] {
  let end = rows.length;
  while (end > 0 && isBlank(rows[end - 1])) end -= 1;
  return end === rows.length ? rows : rows.slice(0, end);
}

/**
 * Continuous entry: the ingredient list always ends with one blank row (ignored by
 * validation and by the payload) until the list is full.
 */
export function withTrailingBlankIngredient(rows: IngredientRowValue[]): IngredientRowValue[] {
  const last = rows[rows.length - 1];
  if (last && isBlankIngredientRow(last)) return rows;
  if (rows.length >= RECIPE_LIMITS.ingredients) return rows;
  return [...rows, createIngredientRow()];
}

/**
 * What happens to an ingredient when focus leaves its row, and what the payload applies
 * too so preview and submit agree: the amount is normalised ('1,5' -> '1.5'), 'to taste'
 * carries no amount, and an amount without a unit gets 'units' (the server requires one).
 */
export function normaliseIngredientRow<T extends IngredientRowInput>(row: T): T {
  const amount = normaliseAmount(row.amount);
  const unit = row.unit.trim();
  const next = {
    ...row,
    amount,
    unit: amount !== '' && unit === '' ? RECIPE_DEFAULT_UNIT : unit,
  };
  return next.amount === row.amount && next.unit === row.unit ? row : next;
}

export function createEmptyValues(): RecipeFormValues {
  return {
    title: '',
    description: '',
    imageUrl: '',
    caption: '',
    prepTime: '',
    cookingTime: '',
    servings: DEFAULT_SERVINGS,
    difficulty: 'medium',
    ingredients: [createIngredientRow()],
    steps: [createStepRow()],
  };
}

/** Rows always get fresh ids unless they bring one; the ingredient list gets its blank row */
export function hydrateValues(input: RecipeFormValuesInput): RecipeFormValues {
  const { ingredients, steps, ...scalars } = input;
  return {
    ...scalars,
    ingredients: withTrailingBlankIngredient(ingredients.map((row) => createIngredientRow(row))),
    steps: steps.length > 0 ? steps.map((row) => createStepRow(row)) : [createStepRow()],
  };
}

/** Edit: a stored 'to taste' ingredient maps back to the named row without amount or unit */
export function valuesFromRecipe(recipe: Recipe): RecipeFormValues {
  return hydrateValues({
    title: recipe.title,
    description: recipe.description,
    imageUrl: recipe.imageUrl,
    caption: recipe.caption ?? '',
    prepTime: recipe.prepTime,
    cookingTime: recipe.cookingTime,
    servings: recipe.servings,
    difficulty: recipe.difficulty,
    ingredients: recipe.ingredients.map(({ name, amount, unit }) => ({
      name,
      amount,
      unit: unit === UNIT_TO_TASTE && amount.trim() === '' ? '' : unit,
    })),
    steps: recipe.instructions.map(({ description, image }) => ({
      description,
      image: image ?? '',
    })),
  });
}

/**
 * Values without row ids and without trailing blank rows, as a stable string: used to
 * tell whether the author changed anything (`isDirty`) and whether a draft needs writing.
 */
export function snapshotValues(values: RecipeFormValuesInput): string {
  const { ingredients, steps, ...scalars } = values;
  return JSON.stringify({
    title: scalars.title,
    description: scalars.description,
    imageUrl: scalars.imageUrl,
    caption: scalars.caption,
    prepTime: scalars.prepTime,
    cookingTime: scalars.cookingTime,
    servings: scalars.servings,
    difficulty: scalars.difficulty,
    ingredients: trimTrailingBlankRows(ingredients, isBlankIngredientRow).map(
      ({ name, amount, unit }) => ({ name, amount, unit })
    ),
    steps: trimTrailingBlankRows(steps, isBlankStepRow).map(({ description, image }) => ({
      description,
      image,
    })),
  });
}
