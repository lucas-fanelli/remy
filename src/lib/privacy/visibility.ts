import type { Prisma } from '@prisma/client';

/**
 * Who may see a private account's recipes. This is the one place the rule is written.
 *
 * A viewer may see an owner's CONTENT if and only if the owner is public, or the viewer IS
 * the owner. Signed out, a viewer sees public owners only. Followers are not let in yet;
 * when they are (S3, the follow-requests slice), the change stays inside this file, and
 * each function below says where it goes.
 *
 * CONTENT is the owner's recipes and everything reached through a recipe id — the detail,
 * comments (read and write), the rating aggregate and rating writes, like, save, cook-plan,
 * mark-cooked — plus the owner's followers and following lists. The profile HEADER is not
 * content: id, username, fullName, avatar, bio, isPrivate, the three counts and the viewer's
 * own follow state are shown on a locked profile too.
 *
 * Before this file the rule had been copied into eleven places in three spellings — a
 * `user: { isPrivate: false }` filter, an `isPrivate && viewer !== owner` check and a raw
 * `"isPrivate" = false` — and the copies disagreed. The filters hid a private author's own
 * recipes from them in the feed, search and pantry matches. The routes reached through a
 * recipe id (like, save, rating, comments, cook-plan, mark-cooked) carried no copy at all:
 * they checked at most that the recipe existed, so anyone holding the id of a private recipe
 * could read its comments and rating, and write to it. privacy-conventions.test.ts fails on
 * a new copy, and on a recipe-scoped handler that skips canSeePost.
 */

/** The account whose content is being asked for: a recipe's author, a profile's owner. */
export interface ContentOwner {
  id: string;
  isPrivate: boolean;
}

/**
 * What the rule may read: `prisma`, or the `tx` of an interactive transaction. A route that
 * checks and then writes inside a transaction passes its `tx`, so the check runs in the same
 * transaction as the write it guards.
 *
 * `follow` is listed although nothing here reads it yet: it is the table S3 reads, and
 * listing it now means adding the follower arm changes no caller.
 */
export type VisibilityDb = Pick<Prisma.TransactionClient, 'post' | 'follow'>;

/**
 * The rule itself, pure: may `viewerId` (null when signed out) see `owner`'s content?
 *
 * For code that already holds everything the rule needs — the owner row today, and from S3
 * on whether the viewer follows them, loaded in the same query. Code that would have to
 * look that up calls canViewContentOf instead.
 */
export function canViewContent(viewerId: string | null, owner: ContentOwner): boolean {
  if (!owner.isPrivate) return true;
  if (viewerId === null) return false;
  // S3 (followers): the follower arm of the rule goes here. canViewContent gains a third
  // parameter, `viewerFollowsOwner = false`, and this line becomes
  //   return viewerId === owner.id || viewerFollowsOwner;
  // The default keeps a caller that does not know the answer failing closed.
  return viewerId === owner.id;
}

/**
 * The rule for one owner, asking the database whatever it needs in order to decide.
 *
 * Today it needs nothing — public-or-owner is known from the owner row — so `db` goes
 * unread. S3 adds exactly one query here, and only for a private owner and a signed-in
 * viewer who is not the owner; the lookup rides @@unique([followerId, followingId]):
 *
 *   if (!owner.isPrivate || viewerId === null || viewerId === owner.id) {
 *     return canViewContent(viewerId, owner);
 *   }
 *   const follow = await db.follow.findUnique({
 *     where: { followerId_followingId: { followerId: viewerId, followingId: owner.id } },
 *     select: { id: true },
 *   });
 *   return canViewContent(viewerId, owner, follow !== null);
 *
 * The profile, followers, following, stats and user-recipes routes decide through this, and
 * canSeePost does too, so that one change reaches all of them.
 */
export async function canViewContentOf(
  db: VisibilityDb,
  viewerId: string | null,
  owner: ContentOwner
): Promise<boolean> {
  return canViewContent(viewerId, owner);
}

/**
 * The same rule as a Post filter, for lists: the feed, search, pantry matches, Saved and the
 * cooked history.
 *
 * ALWAYS NEST IT UNDER `AND`:
 *
 *   where: { AND: [visiblePostsWhere(viewerId)], OR: [{ title: ... }, { description: ... }] }
 *
 * For a signed-in viewer this is itself an `OR`, and the feed and search already keep their
 * text query in `OR`. Spread into the same object, one `OR` silently replaces the other:
 * either the text query is dropped or the privacy filter is, and nothing fails.
 */
export function visiblePostsWhere(viewerId: string | null): Prisma.PostWhereInput {
  const publicAuthor: Prisma.PostWhereInput = { user: { isPrivate: false } };
  if (viewerId === null) return publicAuthor;
  // S3 (followers) adds the third arm here, and nowhere else:
  //   { user: { followers: { some: { followerId: viewerId } } } }
  // It is right only once `User.followers` means the Follow rows whose followingId is that
  // user. Today the two relation names are swapped — schema.prisma pairs User.followers with
  // Follow.follower, on followerId — and a separate PR fixes them. The arm must not land
  // before that fix: against today's schema it would match only the author themself.
  return { OR: [publicAuthor, { userId: viewerId }] };
}

/** What a recipe id leads to, for one viewer. */
export type PostAccess =
  | { status: 'ok'; authorId: string }
  | { status: 'notFound' }
  | { status: 'private'; authorUsername: string };

/** The two answers after which a route stops before touching anything else. */
export type DeniedPostAccess = Exclude<PostAccess, { status: 'ok' }>;

/**
 * The gate for every route reached through a recipe id: read the author, apply the rule.
 *
 * Call it before any other query about the recipe, and stop on anything but 'ok' —
 * deniedPostResponse turns the answer into the response. Nothing may run first: not the
 * like, not the rating recalculation, not the comment count. A write or an aggregate for a
 * recipe the viewer cannot see is exactly what this closes.
 *
 * `authorId` comes back so a route that notifies the author need not read the post again.
 * `authorUsername` comes back on 'private' so the client can link to the author's profile;
 * a username is header, not content.
 */
export async function canSeePost(
  db: VisibilityDb,
  postId: string,
  viewerId: string | null
): Promise<PostAccess> {
  const post = await db.post.findUnique({
    where: { id: postId },
    select: { userId: true, user: { select: { isPrivate: true, username: true } } },
  });
  if (!post) return { status: 'notFound' };

  const author: ContentOwner = { id: post.userId, isPrivate: post.user.isPrivate };
  if (!(await canViewContentOf(db, viewerId, author))) {
    return { status: 'private', authorUsername: post.user.username };
  }
  return { status: 'ok', authorId: post.userId };
}

/**
 * The one answer a recipe-scoped route gives when canSeePost says no, so the client reads
 * the same body whichever route it asked:
 *
 *   404 { error, code: 'recipe.notFound' }
 *   403 { error, code: 'user.profilePrivate', author: { username } }
 *
 * GET /api/recipes/[id] answers through here too. The 403 is not dressed up as a 404: the
 * profile already tells anyone that the account exists and is private, and the client needs
 * the difference to say "this account is private" and link to it, rather than "this recipe
 * was deleted".
 *
 * A plain Response rather than NextResponse, which a route handler may return all the same,
 * so this module stays importable from code whose tests run under jsdom, where merely
 * importing next/server throws "Request is not defined".
 */
export function deniedPostResponse(access: DeniedPostAccess): Response {
  if (access.status === 'notFound') {
    return Response.json({ error: 'Recipe not found', code: 'recipe.notFound' }, { status: 404 });
  }
  return Response.json(
    {
      error: 'This profile is private',
      code: 'user.profilePrivate',
      author: { username: access.authorUsername },
    },
    { status: 403 }
  );
}
