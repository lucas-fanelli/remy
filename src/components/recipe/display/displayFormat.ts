import { RECIPE_DEFAULT_UNIT, UNIT_TO_TASTE } from '@/lib/constants';

/**
 * Wording rules shared by the recipe page and the form's preview, so what the author
 * sees while writing is what gets published.
 */

/**
 * An ingredient as the Json column can really hold it. The form always writes three
 * strings, but seeded and legacy rows carry numeric amounts (`amount: 400`) or miss a
 * field, and the repository only casts the column. Display code must read every shape
 * without throwing. The domain `Ingredient` is assignable to this.
 */
export interface StoredIngredient {
  name?: string | null;
  amount?: string | number | null;
  unit?: string | null;
}

export interface IngredientParts {
  /** The bold part in front of the name: '200 g', '2', or '' when there is nothing to print */
  quantity: string;
  name: string;
  /** Printed after the name as ', to taste' */
  toTaste: boolean;
}

/** Never trust the stored type: 400 -> '400', null / undefined -> '' */
const toText = (value: unknown): string => (value == null ? '' : String(value).trim());

/**
 * - a 'to taste' row reads '{name}, to taste' (never a bold ' to taste' before the name)
 * - the generic unit 'units' is not printed: '2 eggs', not '2 units eggs'
 * - every other unit, legacy ones included ('pieces', 'whole'), prints as stored
 */
export function getIngredientParts(ingredient: StoredIngredient): IngredientParts {
  const amount = toText(ingredient.amount);
  const unit = toText(ingredient.unit);
  const toTaste = unit.toLowerCase() === UNIT_TO_TASTE;
  const printedUnit = toTaste || unit === RECIPE_DEFAULT_UNIT ? '' : unit;

  return {
    quantity: [amount, printedUnit].filter(Boolean).join(' '),
    name: toText(ingredient.name),
    toTaste,
  };
}

/**
 * '1 serving', '4 servings'.
 *
 * @deprecated Still English, and the last string in this file that is. The recipe page and
 * the feed card print `recipe.meta.servings`, an ICU plural, through `useTranslations`
 * instead. Its one remaining caller is the form's RecipePreview, which belongs to the
 * editor's owner: when that screen moves to `t('recipe.meta.servings', { count })` this
 * function and its unit test go with it.
 */
export const formatServings = (servings: number): string =>
  `${servings} ${servings === 1 ? 'serving' : 'servings'}`;
