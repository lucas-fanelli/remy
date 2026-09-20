import prisma from '@/lib/database/prisma';
import type { ViewerState } from '@/domain/types/recipe';

/**
 * Fills in {@link ViewerState} — what YOU did to a recipe, as opposed to what everyone did
 * to it, which is the `likeCount` / `commentCount` / `averageRating` numbers next to it.
 *
 * Until this existed, no list endpoint answered "did I like this", so every surface
 * invented an answer: the feed hardcoded `liked: false`, the recipe page fired two extra
 * round trips at `GET /api/recipes/[id]/like` and `/save`, and search did not ask at all.
 * A heart was red only if you had clicked it since the page loaded.
 */

/**
 * `null` means "nobody is signed in", which is NOT the same as "signed in and has done
 * nothing". The UI needs to tell those apart: one shows a heart that invites you to sign
 * in, the other an empty heart you can fill. Returning `liked: false` for a guest is what
 * made those two states indistinguishable.
 */
export type ViewerStateLookup = (postId: string) => ViewerState | null;

export type { ViewerState };

const UNTOUCHED: ViewerState = Object.freeze({
  liked: false,
  saved: false,
  cooked: false,
  myRating: null,
});

/** The four tables that hold per-user truth about a post. */
type ViewerTables = Pick<typeof prisma, 'like' | 'savedRecipe' | 'cookedRecipe' | 'rating'>;

/**
 * Reads the viewer's relationship to a batch of posts in four queries, regardless of how
 * many posts there are — the N+1 that a per-card probe would cause is the reason the
 * feed never had this data in the first place.
 *
 * Pass the posts you are about to serialise; call the returned lookup once per post.
 *
 * ```ts
 * const viewerState = await loadViewerState(viewerId, posts.map((p) => p.id));
 * const body = posts.map((p) => ({ ...serialise(p), viewer: viewerState(p.id) }));
 * ```
 */
export async function loadViewerState(
  viewerId: string | null | undefined,
  postIds: readonly string[],
  db: ViewerTables = prisma
): Promise<ViewerStateLookup> {
  if (!viewerId) return () => null;
  if (postIds.length === 0) return () => UNTOUCHED;

  const ids = Array.from(new Set(postIds));
  const scope = { userId: viewerId, postId: { in: ids } } as const;

  const [likes, saves, cooked, ratings] = await Promise.all([
    db.like.findMany({ where: scope, select: { postId: true } }),
    db.savedRecipe.findMany({ where: scope, select: { postId: true } }),
    // A cooked entry is soft-deleted by `deletedAt`, and the same recipe can be cooked
    // many times, so this is "at least one live entry" rather than a unique row.
    db.cookedRecipe.findMany({
      where: { ...scope, deletedAt: null },
      select: { postId: true },
      distinct: ['postId'],
    }),
    db.rating.findMany({ where: scope, select: { postId: true, rating: true } }),
  ]);

  const likedIds = new Set(likes.map((row) => row.postId));
  const savedIds = new Set(saves.map((row) => row.postId));
  const cookedIds = new Set(cooked.map((row) => row.postId));
  const ratingByPost = new Map(ratings.map((row) => [row.postId, row.rating]));

  return (postId) => ({
    liked: likedIds.has(postId),
    saved: savedIds.has(postId),
    cooked: cookedIds.has(postId),
    myRating: ratingByPost.get(postId) ?? null,
  });
}
