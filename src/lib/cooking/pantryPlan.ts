import striptags from 'striptags';
import { convertAmount, normalizeIngredientName, parseAmount } from '@/lib/utils/ingredients';

/**
 * Working out what cooking a recipe would do to your pantry, without doing it.
 *
 * This used to live inside the transaction that wrote the cooked entry, which meant the
 * only way to find out what would be deducted was to deduct it. The dialog that asked
 * "cook anyway?" could therefore only describe the one case the deduction happened to
 * collect — ingredients you had but not enough of. An ingredient you did not have at all,
 * or held in a unit the matcher could not compare, produced no entry and no deduction: the
 * recipe was marked cooked and the pantry was untouched, with nothing said.
 *
 * Planning is now a pure function over the two lists, so the same answer can be shown
 * before anything is written.
 */

export interface PantryItemLike {
  id: string;
  name: string;
  unit: string;
  quantity: number;
}

export interface RecipeIngredientLike {
  name: string;
  amount: string;
  unit: string;
}

export type IngredientPlanStatus =
  /** In the pantry, in a comparable unit, and there is enough. */
  | 'deduct'
  /** In the pantry, but less than the recipe asks for. */
  | 'short'
  /** Not in the pantry at all, or held in a unit that cannot be compared to the recipe's. */
  | 'missing'
  /** "To taste", or an amount that is not a number. Nothing to deduct, and not a shortage. */
  | 'unmeasured';

export interface IngredientPlan {
  name: string;
  /** The unit the recipe asks in. */
  unit: string;
  /** How much the recipe asks for, in `unit`. Null when unmeasured. */
  required: number | null;
  /** How much you have, expressed in the recipe's `unit`. Null when it cannot be compared. */
  available: number | null;
  status: IngredientPlanStatus;
  pantryItemId: string | null;
  /** What the pantry actually stores this in — differs from `unit` after a conversion. */
  pantryUnit: string | null;
  /** How much you have, in the pantry's own unit. Shown when `available` is null. */
  pantryQuantity: number | null;
  /** How much to subtract from the pantry row, in the pantry's unit. */
  deduct: number;
  /** Whether applying this plan empties the pantry row. */
  emptiesPantryItem: boolean;
}

export interface PantryPlan {
  ingredients: IngredientPlan[];
  /** Nothing missing and nothing short: cooking this takes no explaining. */
  canCookNow: boolean;
}

/** Only the entries that change the pantry. */
export function deductions(plan: PantryPlan): IngredientPlan[] {
  return plan.ingredients.filter((i) => i.deduct > 0);
}

/** What the reader has to be told about before they commit. */
export function shortfalls(plan: PantryPlan): IngredientPlan[] {
  return plan.ingredients.filter((i) => i.status === 'short' || i.status === 'missing');
}

/**
 * Decide what cooking `recipeIngredients` would take out of `pantryItems`.
 *
 * Names must match exactly once normalised — deliberately not the fuzzy match used by the
 * recipe matcher, so that "rice vinegar" is never taken for "rice". Units are compared by
 * conversion, so a pantry holding kilograms can satisfy a recipe asking for grams.
 */
export function planPantryDeduction(
  pantryItems: readonly PantryItemLike[],
  recipeIngredients: readonly RecipeIngredientLike[]
): PantryPlan {
  const claimed = new Set<string>();
  const ingredients: IngredientPlan[] = [];

  for (const ingredient of recipeIngredients) {
    const name = striptags(ingredient.name);
    const unit = striptags(ingredient.unit);
    const wanted = parseAmount(ingredient.amount);
    const hasAmount = Number.isFinite(wanted) && wanted > 0;

    const match = pantryItems.find(
      (item) =>
        !claimed.has(item.id) &&
        normalizeIngredientName(item.name) === normalizeIngredientName(ingredient.name)
    );

    // "To taste" and friends: there is nothing to subtract, and it is not a shortage.
    // The pantry row is deliberately left unclaimed — a later line naming the same
    // ingredient with a real amount should still be able to use it.
    if (!hasAmount) {
      ingredients.push({
        name,
        unit,
        required: null,
        available: null,
        status: 'unmeasured',
        pantryItemId: match?.id ?? null,
        pantryUnit: match?.unit ?? null,
        pantryQuantity: match?.quantity ?? null,
        deduct: 0,
        emptiesPantryItem: false,
      });
      continue;
    }

    if (!match) {
      ingredients.push({
        name,
        unit,
        required: wanted,
        available: 0,
        status: 'missing',
        pantryItemId: null,
        pantryUnit: null,
        pantryQuantity: null,
        deduct: 0,
        emptiesPantryItem: false,
      });
      continue;
    }

    // How much of the pantry row the recipe is asking for, in the pantry's own unit.
    const wantedInPantryUnit = convertAmount(wanted, unit, match.unit);

    if (wantedInPantryUnit === null) {
      // Same ingredient, units that do not measure the same thing — 2 cloves against a
      // pantry in grams. Reported rather than skipped, and the row stays unclaimed so it
      // is not withheld from another line that could use it.
      ingredients.push({
        name,
        unit,
        required: wanted,
        available: null,
        status: 'missing',
        pantryItemId: match.id,
        pantryUnit: match.unit,
        pantryQuantity: match.quantity,
        deduct: 0,
        emptiesPantryItem: false,
      });
      continue;
    }

    claimed.add(match.id);
    const availableInRecipeUnit = convertAmount(match.quantity, match.unit, unit) ?? 0;

    if (match.quantity >= wantedInPantryUnit) {
      const remaining = match.quantity - wantedInPantryUnit;
      ingredients.push({
        name,
        unit,
        required: wanted,
        available: availableInRecipeUnit,
        status: 'deduct',
        pantryItemId: match.id,
        pantryUnit: match.unit,
        pantryQuantity: match.quantity,
        deduct: wantedInPantryUnit,
        emptiesPantryItem: remaining <= 0,
      });
      continue;
    }

    // Some, but not enough. Cooking anyway uses up what is there.
    ingredients.push({
      name,
      unit,
      required: wanted,
      available: availableInRecipeUnit,
      status: 'short',
      pantryItemId: match.id,
      pantryUnit: match.unit,
      pantryQuantity: match.quantity,
      deduct: match.quantity,
      emptiesPantryItem: match.quantity > 0,
    });
  }

  return {
    ingredients,
    canCookNow: !ingredients.some((i) => i.status === 'short' || i.status === 'missing'),
  };
}
