import { Ingredient, Instruction } from '@/domain/types/recipe';
import { UNIT_TO_TASTE } from '@/lib/constants';
import {
  isBlankIngredientRow,
  isBlankStepRow,
  isToTasteRow,
  normaliseIngredientRow,
  trimTrailingBlankRows,
} from './formValues';
import {
  CreateRecipePayload,
  NumericFieldValue,
  RecipeFormMode,
  RecipeFormValuesInput,
  RecipePayload,
  UpdateRecipePayload,
} from './types';

/**
 * The ONLY normaliser between the form and the API, and also what RecipePreview renders,
 * so numbering and dropped rows can never disagree with what is sent.
 *
 * Every object is rebuilt field by field: row ids and any other client-only key can not
 * leak. That is doubly load-bearing - POST /api/recipes is `.strict()` (a leaked key is a
 * 400) and PUT /api/recipes/[id] has no schema (a leaked key would be STORED).
 */

// '' (not typed yet) becomes 0 so the preview can render; validateRecipe blocks a submit
const toNumber = (value: NumericFieldValue): number => (value === '' ? 0 : value);

const toIngredient = (rawRow: RecipeFormValuesInput['ingredients'][number]): Ingredient => {
  const row = normaliseIngredientRow(rawRow);
  if (isToTasteRow(row)) {
    return { name: row.name.trim(), amount: '', unit: UNIT_TO_TASTE };
  }
  return { name: row.name.trim(), amount: row.amount, unit: row.unit };
};

export function toPayload(values: RecipeFormValuesInput, mode: 'create'): CreateRecipePayload;
export function toPayload(values: RecipeFormValuesInput, mode: 'edit'): UpdateRecipePayload;
export function toPayload(values: RecipeFormValuesInput, mode: RecipeFormMode): RecipePayload;
export function toPayload(values: RecipeFormValuesInput, mode: RecipeFormMode): RecipePayload {
  const caption = values.caption.trim();

  const core = {
    title: values.title.trim(),
    description: values.description.trim(),
    imageUrl: values.imageUrl,
    cookingTime: toNumber(values.cookingTime),
    prepTime: toNumber(values.prepTime),
    servings: toNumber(values.servings),
    difficulty: values.difficulty,
    // A blank ingredient row carries nothing, wherever it is
    ingredients: values.ingredients.filter((row) => !isBlankIngredientRow(row)).map(toIngredient),
    // Only TRAILING blank steps are dropped; the API requires step === position
    instructions: trimTrailingBlankRows(values.steps, isBlankStepRow).map(
      (row, index): Instruction => {
        const step = { step: index + 1, description: row.description.trim() };
        return row.image === '' ? step : { ...step, image: row.image };
      }
    ),
  };

  if (mode === 'edit') {
    return { ...core, caption: caption === '' ? null : caption };
  }
  // userId is a placeholder that useCreateRecipe strips: the author comes from the session
  return { ...core, userId: '', caption };
}
