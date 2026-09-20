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
 * How a unit is PRINTED. The stored value never changes language (the pantry matcher and
 * the parser compare against it), so this only decides the label: pass `useUnitLabels().label`
 * from a component and 'cups' reads 'tazas' in Spanish while the row still says 'cups'.
 * The default keeps the stored value, which is what a plain unit test wants.
 */
export type UnitLabeller = (unit: string, count: number) => string;

const asStored: UnitLabeller = (unit) => unit;

/**
 * - a 'to taste' row reads '{name}, to taste' (never a bold ' to taste' before the name)
 * - the generic unit 'units' is not printed: '2 eggs', not '2 units eggs'
 * - every other unit, legacy ones included ('pieces', 'whole'), goes through `unitLabel`,
 *   which falls back to the stored value for anything it does not know
 */
export function getIngredientParts(
  ingredient: StoredIngredient,
  unitLabel: UnitLabeller = asStored
): IngredientParts {
  const amount = toText(ingredient.amount);
  const unit = toText(ingredient.unit);
  const toTaste = unit.toLowerCase() === UNIT_TO_TASTE;
  // A fraction ('1/2') or an empty amount is not a number: one is the plural rule to use for
  // them. '0' is a number, and a falsy one, so it needs an explicit test rather than `|| 1`.
  const parsed = Number(amount);
  const count = amount !== '' && Number.isFinite(parsed) ? parsed : 1;
  const printedUnit = toTaste || unit === RECIPE_DEFAULT_UNIT ? '' : unitLabel(unit, count);

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
