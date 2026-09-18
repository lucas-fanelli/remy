-- AlterTable
-- Columns added to CookedRecipe in schema.prisma after 0_init (pantry deduction
-- reversal + soft delete). IF NOT EXISTS keeps this safe on databases that were
-- synced with `prisma db push` and may already have some of them.
ALTER TABLE "cooked_recipes"
  ADD COLUMN IF NOT EXISTS "deductedIngredients" JSONB,
  ADD COLUMN IF NOT EXISTS "restoredAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
