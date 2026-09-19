/** Shared application constants */

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const MAX_UPLOAD_SIZE = 5 * 1024 * 1024; // 5MB

export const MAX_PANTRY_ITEMS = 500;

export const MAX_COMMENT_LENGTH = 5000;

export const MAX_NOTES_LENGTH = 5000;

export const MAX_SEARCH_QUERY_LENGTH = 200;

export const MAX_ITEM_NAME_LENGTH = 200;

export const MAX_QUANTITY = 999999;

export const MAX_DAILY_COOKS = 20;
export const MAX_DAILY_RECIPES = 10;

/**
 * PostgreSQL advisory lock key registry.
 *
 * We use the two-key form of pg_advisory_xact_lock(key1, key2):
 *   - key1: a feature-level namespace (the constants below) that identifies
 *     which subsystem owns the lock.
 *   - key2: an instance discriminator within that namespace. Use 0 for global
 *     (one-at-a-time) locks, or hashtext(userId) / similar for per-entity locks.
 *
 * The two-key form keeps each feature's lock space independent so a lock in
 * one subsystem can never collide with a lock in another, even if the
 * instance keys happen to match.
 *
 * All advisory lock keys must be registered here to prevent collisions.
 *
 * IMPORTANT: always cast key1 in raw SQL — `pg_advisory_xact_lock(${KEY}::int, ...)`.
 * Prisma binds JS numbers as bigint, and PostgreSQL only defines the two-key form
 * as (int, int), so without the cast the call fails with
 * "function pg_advisory_xact_lock(bigint, integer) does not exist".
 *
 * Raw SQL must also use the real table names from @@map in schema.prisma
 * ("posts", "users", "user_pantries", ...), never the Prisma model names.
 *
 * Key allocation:
 *   48879 - Recalculate ratings admin endpoint (key2 = 0, global)
 *   48880 - Admin user delete / demote endpoint (key2 = 0, global)
 *   48881 - Cooked recipe pantry deduction (key2 = hashtext(userId), per-user)
 *   48882 - Orphaned image cleanup script (key2 = 0, global)
 *   48883 - Recipe match endpoint (key2 = hashtext(userId), per-user)
 *   48884 - Recipe create daily-limit check (key2 = hashtext(userId), per-user)
 */
export const PG_ADVISORY_LOCK_RECALC_RATINGS = 48879;
export const PG_ADVISORY_LOCK_ADMIN_DELETE = 48880;
export const PG_ADVISORY_LOCK_COOKED_RECIPE = 48881;
export const PG_ADVISORY_LOCK_CLEANUP = 48882;
export const PG_ADVISORY_LOCK_MATCH = 48883;
export const PG_ADVISORY_LOCK_RECIPE_CREATE = 48884;

/** Canonical "to taste" unit value used across forms, validation, and display */
export const UNIT_TO_TASTE = 'to taste';

/** Username: alphanumeric + underscore, 3-30 chars (matches registration schema) */
export const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,30}$/;

/**
 * Recipe form limits. They mirror the zod schemas in src/app/api/recipes/route.ts and
 * RecipeService.validateRecipeData; a text-based parity test keeps the numbers in sync
 * (the route's schemas are not exported).
 */
export const RECIPE_LIMITS = {
  title: 100,
  description: 500,
  caption: 500,
  cook: { min: 1, max: 720 },
  prep: { min: 0, max: 480 },
  servings: { min: 1, max: 100 },
  ingredients: 100,
  name: 200,
  amount: 50,
  unit: 50,
  steps: 50,
  stepText: 5000,
} as const;

/** The closed, metric-first unit list offered by the recipe form */
export const RECIPE_UNITS = [
  'g',
  'kg',
  'mL',
  'L',
  'units',
  'tsp',
  'tbsp',
  'cups',
  'pinch',
  'oz',
  'lb',
  UNIT_TO_TASTE,
] as const;

export type RecipeUnit = (typeof RECIPE_UNITS)[number];

/** Expanded option text for the unit list ('g - grams'); the stored value stays short */
export const RECIPE_UNIT_LABELS: Record<RecipeUnit, string> = {
  g: 'grams',
  kg: 'kilograms',
  mL: 'millilitres',
  L: 'litres',
  units: 'whole items',
  tsp: 'teaspoons',
  tbsp: 'tablespoons',
  cups: 'cups',
  pinch: 'pinch',
  oz: 'ounces',
  lb: 'pounds',
  [UNIT_TO_TASTE]: 'no exact amount',
};

/** Unit filled in when an ingredient has an amount but no unit (the server requires one) */
export const RECIPE_DEFAULT_UNIT: RecipeUnit = 'units';
