import type { PrismaClient } from '@prisma/client';

/**
 * One reader's score for one recipe, and the recipe-wide average derived from all of them.
 *
 * `Rating` has always been its own table, unique per (user, post) — the score was never
 * really part of a comment. Only the UI welded them: the sole way to give one was the
 * comment box, and deleting that comment deleted the score, except when the reader also
 * had a cooked entry, which someone had to carve out by hand. Both endpoints wrote their
 * own copy of the aggregation below, and the copies had already drifted.
 */

/** Anything that can read and write the two tables inside a transaction. */
type RatingStore = Pick<PrismaClient, 'rating' | 'post'> & {
  $executeRaw: PrismaClient['$executeRaw'];
};

export interface RecipeRatingSummary {
  /**
   * Mean score to one decimal place; 0 when nobody has rated it. `reviewCount` is what
   * tells those apart — `Post.averageRating` is `Float @default(0)`, not nullable, so
   * there is no "no value" to write. Display code keys off the count, never off a 0 here.
   */
  averageRating: number;
  /** How many people have rated it. */
  reviewCount: number;
}

/**
 * Recompute a recipe's cached average from its ratings and store it.
 *
 * Call inside a transaction, after the caller has locked the post row.
 *
 * Writes 0 when the last rating goes away. The hand-written copies of this passed
 * `undefined` there, which Prisma reads as "leave this column alone" — so a recipe whose
 * ratings had all been removed kept the average it used to have. One of those copies
 * carried a comment claiming it wrote null; it wrote neither.
 */
export async function recalculateRecipeRating(
  tx: RatingStore,
  postId: string
): Promise<RecipeRatingSummary> {
  const aggregate = await tx.rating.aggregate({
    where: { postId },
    _avg: { rating: true },
    _count: { rating: true },
  });

  const averageRating =
    aggregate._avg.rating != null ? Math.round(aggregate._avg.rating * 10) / 10 : 0;
  const reviewCount = aggregate._count.rating ?? 0;

  await tx.post.update({
    where: { id: postId },
    data: { averageRating, reviewCount },
  });

  return { averageRating, reviewCount };
}

/**
 * Take a row lock on the recipe so two ratings landing at once cannot both read the old
 * set and write averages that disagree with it.
 */
export async function lockRecipeForRating(tx: RatingStore, postId: string): Promise<void> {
  await tx.$executeRaw`SELECT id FROM "posts" WHERE id = ${postId} FOR UPDATE`;
}

/** Whether a value is a score this app accepts. */
export function isValidRating(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 5;
}
