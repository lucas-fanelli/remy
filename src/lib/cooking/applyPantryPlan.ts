import striptags from 'striptags';
import { deductions, type IngredientPlan, type PantryPlan } from './pantryPlan';
import type { PrismaClient } from '@prisma/client';

/** What was actually taken out, kept on the cooked entry so the move can be undone. */
export interface DeductedIngredient {
  name: string;
  amount: number;
  unit: string;
  pantryItemId: string;
}

type PantryWriter = {
  pantryItem: Pick<PrismaClient['pantryItem'], 'update' | 'delete'>;
};

/**
 * Carry out a plan produced by {@link planPantryDeduction}.
 *
 * Must run inside a transaction, under the caller's advisory lock: the plan was decided
 * against quantities read earlier, and nothing here re-checks them.
 *
 * The amounts recorded are in the **pantry's** unit, not the recipe's, because that is
 * what an undo has to put back.
 */
export async function applyPantryPlan(
  tx: PantryWriter,
  plan: PantryPlan
): Promise<DeductedIngredient[]> {
  const applied: DeductedIngredient[] = [];

  for (const ingredient of deductions(plan)) {
    // deductions() only yields entries with deduct > 0, which the planner only sets when
    // it found a pantry item — so the id is present.
    const pantryItemId = ingredient.pantryItemId!;

    if (ingredient.emptiesPantryItem) {
      await tx.pantryItem.delete({ where: { id: pantryItemId } });
    } else {
      await tx.pantryItem.update({
        where: { id: pantryItemId },
        data: { quantity: { decrement: ingredient.deduct } },
      });
    }

    applied.push({
      name: striptags(ingredient.name),
      amount: ingredient.deduct,
      unit: striptags(ingredient.pantryUnit ?? ingredient.unit),
      pantryItemId,
    });
  }

  return applied;
}

/**
 * Read a recipe's `ingredients` JSON into the shape the planner takes.
 *
 * The column is free-form JSON that predates any validation, so anything that is not a
 * usable ingredient object is dropped rather than trusted. Returns null when the whole
 * list is unusable, which the caller reports instead of silently cooking with no deduction.
 */
export function readRecipeIngredients(
  raw: unknown
): { name: string; amount: string; unit: string }[] | null {
  if (!Array.isArray(raw)) return null;

  const ingredients = raw
    .filter(
      (i): i is Record<string, unknown> => i != null && typeof i === 'object' && !Array.isArray(i)
    )
    .map((i) => ({
      name: striptags(String(i.name ?? '')),
      amount: String(i.amount ?? ''),
      unit: striptags(String(i.unit ?? '')),
    }));

  const usable = ingredients.every(
    (i) => i.name.length > 0 && i.name.length <= 200 && i.unit.length < 50
  );

  return usable ? ingredients : null;
}

export type { IngredientPlan };
