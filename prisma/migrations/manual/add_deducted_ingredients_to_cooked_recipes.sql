-- Add deductedIngredients JSON column to cooked_recipes table
-- Stores pantry deductions made during POST so they can be reversed on DELETE
ALTER TABLE "cooked_recipes" ADD COLUMN IF NOT EXISTS "deductedIngredients" JSONB;
