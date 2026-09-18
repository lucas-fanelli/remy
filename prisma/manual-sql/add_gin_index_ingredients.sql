-- CreateIndex
-- GIN index on the ingredients JSONB column for faster ingredient-based queries.
-- Run manually: psql -f prisma/manual-sql/add_gin_index_ingredients.sql
-- (Kept outside prisma/migrations/: Prisma treats every folder there as a migration,
-- and CREATE INDEX CONCURRENTLY cannot run inside a migration transaction.)
-- Use CONCURRENTLY to avoid locking the table during index creation.
-- The Post model is mapped to the "posts" table (@@map in schema.prisma).
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Post_ingredients_gin_idx" ON "posts" USING GIN ("ingredients");
