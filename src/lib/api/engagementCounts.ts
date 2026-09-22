/**
 * The counters every recipe-bearing endpoint sends, spelled the one way.
 *
 * Measured before this existed, route by route:
 *
 *   /api/recipes                    likeCount    commentCount
 *   /api/search                     likeCount    commentCount
 *   /api/recipes/[id]               likeCount    commentCount
 *   /api/users/[username]/profile   likesCount   commentsCount   (both tabs)
 *   /api/recipes/match              likesCount   commentsCount
 *   /api/users/[username]/recipes   likesCount   commentsCount
 *   /api/users/[username]/saved     likesCount   commentsCount
 *
 * Nothing failed because of it. The profile page carried a rename in its own mapper, and
 * the counts on the pantry matches were simply never read. What it cost was the thing the
 * cache adapters depend on: they patch `likeCount`, so a heart liked on a profile would
 * have updated nothing there — silently, the same failure shape this whole package exists
 * to remove.
 *
 * Only the counters are unified here, deliberately. The routes build genuinely different
 * payloads — a detail page carries steps, a match carries its missing ingredients — and a
 * serializer for the whole recipe would be a large refactor to fix a two-field
 * disagreement. The disagreement was in the counters, so the counters get one spelling.
 *
 * The singular form wins because it is what the one canonical card already takes, and it
 * reads as English: a recipe has a like count, not a likes count. `reviewCount` survives
 * only as the Prisma column name, which every route already publishes as `totalRatings`.
 */
export interface EngagementCounts {
  likeCount: number;
  commentCount: number;
}

/** Map Prisma's `_count` onto the one spelling the client reads. */
export function engagementCounts(count: { likes: number; comments: number }): EngagementCounts {
  return { likeCount: count.likes, commentCount: count.comments };
}
