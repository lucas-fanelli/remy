-- Drop the per-cook rating and notes from cooked_recipes.
--
-- A score lives in `ratings`, one row per (user, post) — that is what the app reads and
-- what `posts.averageRating` is built from. These two columns were a second, per-cook
-- copy: no client ever sent them, no query ever read them back, and nothing rendered
-- them. They were written only by a branch of POST /api/cooked-recipes that the app
-- could not reach.
--
-- This is not reversible. Any values sitting in these columns are lost. In this database
-- they came from a test harness, never from the app.

ALTER TABLE "cooked_recipes" DROP COLUMN "notes",
DROP COLUMN "rating";
