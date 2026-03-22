-- CreateIndex
-- GIN index on the ingredients JSONB column for faster ingredient-based queries.
-- Run manually: psql -f prisma/migrations/manual/add_gin_index_ingredients.sql
-- Use CONCURRENTLY to avoid locking the table during index creation.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Post_ingredients_gin_idx" ON "Post" USING GIN ("ingredients");
