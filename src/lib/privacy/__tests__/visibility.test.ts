/**
 * @jest-environment node
 */
import { Prisma } from '@prisma/client';
import {
  canSeePost,
  canViewContent,
  canViewContentOf,
  deniedPostResponse,
  visiblePostsWhere,
  type ContentOwner,
} from '../visibility';

const OWNER_ID = 'owner-1';
const STRANGER_ID = 'stranger-1';
const FOLLOWER_ID = 'follower-1';

const publicOwner: ContentOwner = { id: OWNER_ID, isPrivate: false };
const privateOwner: ContentOwner = { id: OWNER_ID, isPrivate: true };

/**
 * A stand-in for `prisma` or a transaction's `tx`. The rule may read two tables; the
 * requests table is here as well, full of a pending request from everyone, so a test can
 * show the rule never asks it.
 */
function mockDb({ post = null as unknown, followerIds = [] as string[] } = {}) {
  const pendingRequest = { id: 'request-1', requesterId: STRANGER_ID, targetId: OWNER_ID };
  return {
    post: { findUnique: jest.fn().mockResolvedValue(post) },
    follow: {
      findUnique: jest.fn(
        async ({ where }: { where: { followerId_followingId: { followerId: string } } }) =>
          followerIds.includes(where.followerId_followingId.followerId) ? { id: 'follow-1' } : null
      ),
    },
    followRequest: {
      findUnique: jest.fn().mockResolvedValue(pendingRequest),
      findFirst: jest.fn().mockResolvedValue(pendingRequest),
      findMany: jest.fn().mockResolvedValue([pendingRequest]),
    },
  };
}

/**
 * Every viewer against every owner. "A follower" has a row in "follows" with the owner as
 * followingId; "someone else" has none — in canViewContentOf, someone whose request is
 * pending, since the mock db holds one from them.
 */
const TRUTH_TABLE: Array<
  [
    viewer: string,
    ownerKind: string,
    sees: boolean,
    viewerId: string | null,
    owner: ContentOwner,
    follows: boolean,
  ]
> = [
  ['signed out', 'public', true, null, publicOwner, false],
  ['signed out', 'private', false, null, privateOwner, false],
  ['the owner', 'public', true, OWNER_ID, publicOwner, false],
  ['the owner', 'private', true, OWNER_ID, privateOwner, false],
  ['someone else', 'public', true, STRANGER_ID, publicOwner, false],
  ['someone else', 'private', false, STRANGER_ID, privateOwner, false],
  ['a follower', 'public', true, FOLLOWER_ID, publicOwner, true],
  ['a follower', 'private', true, FOLLOWER_ID, privateOwner, true],
];

describe('canViewContent', () => {
  it.each(TRUTH_TABLE)(
    '%s, %s owner → sees: %p',
    (_viewer, _label, sees, viewerId, owner, follows) => {
      expect(canViewContent(viewerId, owner, follows)).toBe(sees);
    }
  );

  it('keeps a follower out when the caller does not say they follow', () => {
    // The default fails closed: code that forgot to load the follow shows a follower the
    // locked view, never a stranger the recipes.
    expect(canViewContent(FOLLOWER_ID, privateOwner)).toBe(false);
  });

  it('never lets a signed-out viewer into a private account, whatever it is told', () => {
    expect(canViewContent(null, privateOwner, true)).toBe(false);
  });
});

describe('canViewContentOf', () => {
  it.each(TRUTH_TABLE)(
    '%s, %s owner → sees: %p',
    async (_viewer, _label, sees, viewerId, owner) => {
      const db = mockDb({ followerIds: [FOLLOWER_ID] });

      await expect(canViewContentOf(db as never, viewerId, owner)).resolves.toBe(sees);
    }
  );

  it('asks the database nothing when the owner row already decides', async () => {
    // Public owners, the owner themself and a signed-out viewer never need a follow lookup,
    // and they are nearly every request.
    const db = mockDb({ followerIds: [FOLLOWER_ID] });

    await canViewContentOf(db as never, STRANGER_ID, publicOwner);
    await canViewContentOf(db as never, OWNER_ID, privateOwner);
    await canViewContentOf(db as never, null, privateOwner);

    expect(db.follow.findUnique).not.toHaveBeenCalled();
    expect(db.post.findUnique).not.toHaveBeenCalled();
  });

  it('asks once, by the unique pair, whether someone else follows a private owner', async () => {
    // The lookup rides @@unique([followerId, followingId]): the viewer as follower, the
    // owner as the one followed. Swapped, it would ask whether the owner follows the viewer.
    const db = mockDb({ followerIds: [FOLLOWER_ID] });

    await canViewContentOf(db as never, FOLLOWER_ID, privateOwner);

    expect(db.follow.findUnique).toHaveBeenCalledTimes(1);
    expect(db.follow.findUnique).toHaveBeenCalledWith({
      where: { followerId_followingId: { followerId: FOLLOWER_ID, followingId: OWNER_ID } },
      select: { id: true },
    });
  });

  it('keeps the viewer out when the lookup answers anything but a row', async () => {
    // Prisma answers null; a bare mocked client answers undefined. Neither is a follow.
    const db = mockDb();
    (db.follow.findUnique as jest.Mock).mockResolvedValue(undefined);

    await expect(canViewContentOf(db as never, STRANGER_ID, privateOwner)).resolves.toBe(false);
  });

  it('keeps out someone whose request is pending, and never reads the requests', async () => {
    // A request is not a follow. The mock answers every request lookup with a pending
    // request from this viewer; the rule must not ask, and must say no.
    const db = mockDb();

    await expect(canViewContentOf(db as never, STRANGER_ID, privateOwner)).resolves.toBe(false);
    expect(db.followRequest.findUnique).not.toHaveBeenCalled();
    expect(db.followRequest.findFirst).not.toHaveBeenCalled();
    expect(db.followRequest.findMany).not.toHaveBeenCalled();
  });
});

describe('visiblePostsWhere', () => {
  it('shows a signed-out viewer only recipes by public authors', () => {
    expect(visiblePostsWhere(null)).toEqual({ user: { isPrivate: false } });
  });

  it('shows a signed-in viewer public authors, their own recipes, and authors they follow', () => {
    // The feed, search and matches used to filter on the public arm alone, which hid a
    // private author's own recipes from them. Which way the third arm points is proved
    // below, against the schema; this pins its shape.
    expect(visiblePostsWhere(STRANGER_ID)).toEqual({
      OR: [
        { user: { isPrivate: false } },
        { userId: STRANGER_ID },
        { user: { followers: { some: { followerId: STRANGER_ID } } } },
      ],
    });
  });

  it('hands every caller its own object', () => {
    // Callers nest it into a where they go on to build; a shared constant mutated by one
    // request would change the filter of the next.
    expect(visiblePostsWhere(null)).not.toBe(visiblePostsWhere(null));
    expect(visiblePostsWhere(STRANGER_ID)).not.toBe(visiblePostsWhere(STRANGER_ID));
  });
});

// ---------------------------------------------------------------------------------------
// Which way the follower arm points, run against the schema
// ---------------------------------------------------------------------------------------

/**
 * `followers: { some: { followerId: viewer } }` reads right, and would read just as right
 * with the relation names swapped — which is how schema.prisma had them until
 * follow-relations.test.ts. What the filter means depends on which column the relation
 * named `followers` is joined on, and only the schema knows that; a mocked prisma answers
 * whatever the test tells it.
 *
 * So these tests evaluate the where the way PostgreSQL would, over a few rows, resolving
 * every relation through the generated client's own metadata (Prisma.dmmf): Post.user
 * through Post.userId, User.followers through whichever Follow column carries its relation
 * name. Swap the relation names back, or write the arm as `following` / `followingId`, and
 * the direction tests fail.
 *
 * It knows the filters visiblePostsWhere uses — OR, AND, equality, a to-one relation and
 * `some` — and throws on anything else, so no filter passes by being ignored.
 */
type Row = Record<string, unknown>;
type World = Record<string, Row[]>;

const MODELS = new Map(Prisma.dmmf.datamodel.models.map((model) => [model.name, model]));

function fieldOf(model: string, name: string) {
  const field = MODELS.get(model)?.fields.find((f) => f.name === name);
  if (!field) throw new Error(`${model}.${name} is not in the schema`);
  return field;
}

/** The rows `row` reaches through the relation `name`, found by their key columns. */
function related(world: World, model: string, row: Row, name: string): Row[] {
  const field = fieldOf(model, name);
  const rows = world[field.type] ?? [];
  if (field.relationFromFields?.length) {
    // This side holds the key: Post.user is the User whose id is this post's userId.
    const [from] = field.relationFromFields;
    const [to] = field.relationToFields ?? [];
    return rows.filter((other) => other[to] === row[from]);
  }
  // The other side holds it: User.followers is the Follow rows whose key column — the one
  // on the Follow field with the same relation name — holds this user's id.
  const back = MODELS.get(field.type)?.fields.find(
    (f) => f.relationName === field.relationName && f.relationFromFields?.length
  );
  if (!back?.relationFromFields || !back.relationToFields) {
    throw new Error(`${model}.${name} has no key column on ${field.type}`);
  }
  const [from] = back.relationFromFields;
  const [to] = back.relationToFields;
  return rows.filter((other) => other[from] === row[to]);
}

function matches(world: World, model: string, row: Row, where: object): boolean {
  return Object.entries(where).every(([key, condition]) => {
    if (key === 'OR') return (condition as object[]).some((w) => matches(world, model, row, w));
    if (key === 'AND') return (condition as object[]).every((w) => matches(world, model, row, w));

    const field = fieldOf(model, key);
    if (field.kind !== 'object') {
      if (typeof condition === 'object' && condition !== null) {
        throw new Error(`the stand-in does not know the filter on ${model}.${key}`);
      }
      return row[key] === condition;
    }
    const rows = related(world, model, row, key);
    if (!field.isList) return rows.length === 1 && matches(world, field.type, rows[0], condition);

    const { some, ...rest } = condition as { some?: object };
    if (!some || Object.keys(rest).length > 0) {
      throw new Error(`the stand-in knows only \`some\` on ${model}.${key}`);
    }
    return rows.some((other) => matches(world, field.type, other, some));
  });
}

describe('visiblePostsWhere — which way the follower arm points', () => {
  const VIEWER_ID = 'viewer-1';
  const PUBLIC_AUTHOR_ID = 'public-author-1';

  /**
   * A private owner with one recipe, a public author with one, and the viewer — who keeps a
   * private account too — with one of their own. Only the follows and the requests change.
   */
  function world({ follows = [] as Row[], requests = [] as Row[] } = {}): World {
    return {
      User: [
        { id: OWNER_ID, isPrivate: true },
        { id: PUBLIC_AUTHOR_ID, isPrivate: false },
        { id: VIEWER_ID, isPrivate: true },
      ],
      Post: [
        { id: 'secret-stew', userId: OWNER_ID },
        { id: 'open-salad', userId: PUBLIC_AUTHOR_ID },
        { id: 'viewers-own', userId: VIEWER_ID },
      ],
      Follow: follows,
      FollowRequest: requests,
    };
  }

  const recipesVisibleTo = (viewerId: string | null, w: World) =>
    w.Post.filter((post) => matches(w, 'Post', post, visiblePostsWhere(viewerId))).map(
      (post) => post.id
    );

  it('lets the viewer into a private author they follow', () => {
    const w = world({ follows: [{ followerId: VIEWER_ID, followingId: OWNER_ID }] });

    expect(recipesVisibleTo(VIEWER_ID, w)).toEqual(['secret-stew', 'open-salad', 'viewers-own']);
  });

  it('does not let the viewer into a private author who follows THEM', () => {
    // The same row read the other way round. This is the mistake a swapped relation name,
    // or a mirrored arm, would make, and a shape assertion cannot see it.
    const w = world({ follows: [{ followerId: OWNER_ID, followingId: VIEWER_ID }] });

    expect(recipesVisibleTo(VIEWER_ID, w)).toEqual(['open-salad', 'viewers-own']);
  });

  it('does not let the viewer in on a follow of someone else', () => {
    const w = world({ follows: [{ followerId: VIEWER_ID, followingId: PUBLIC_AUTHOR_ID }] });

    expect(recipesVisibleTo(VIEWER_ID, w)).toEqual(['open-salad', 'viewers-own']);
  });

  it('does not let the viewer in on a pending request', () => {
    // A request from the viewer to the owner, and no follow: it opens nothing.
    const w = world({ requests: [{ requesterId: VIEWER_ID, targetId: OWNER_ID }] });

    expect(recipesVisibleTo(VIEWER_ID, w)).toEqual(['open-salad', 'viewers-own']);
  });

  it('lets a signed-out viewer see public authors only, followers of the owner or not', () => {
    const w = world({ follows: [{ followerId: VIEWER_ID, followingId: OWNER_ID }] });

    expect(recipesVisibleTo(null, w)).toEqual(['open-salad']);
  });
});

describe('canSeePost', () => {
  const POST_ID = 'post-1';
  const postBy = (isPrivate: boolean) => ({
    userId: OWNER_ID,
    user: { isPrivate, username: 'chef_owner' },
  });

  it('says notFound when there is no such recipe', async () => {
    const db = mockDb({ post: null });

    await expect(canSeePost(db as never, POST_ID, STRANGER_ID)).resolves.toEqual({
      status: 'notFound',
    });
  });

  it('reads the recipe by id, and only its author', async () => {
    const db = mockDb({ post: postBy(false) });

    await canSeePost(db as never, POST_ID, STRANGER_ID);

    expect(db.post.findUnique).toHaveBeenCalledTimes(1);
    expect(db.post.findUnique).toHaveBeenCalledWith({
      where: { id: POST_ID },
      select: { userId: true, user: { select: { isPrivate: true, username: true } } },
    });
  });

  it.each([
    ['someone whose request is pending', STRANGER_ID],
    ['a signed-out viewer', null],
  ])(
    'says private, with the author username, to %s on a private recipe',
    async (_who, viewerId) => {
      const db = mockDb({ post: postBy(true), followerIds: [FOLLOWER_ID] });

      await expect(canSeePost(db as never, POST_ID, viewerId)).resolves.toEqual({
        status: 'private',
        authorUsername: 'chef_owner',
      });
    }
  );

  it.each([
    ['the author', OWNER_ID],
    ['a follower of the author', FOLLOWER_ID],
  ])('lets %s into a private recipe, and returns the author id', async (_who, viewerId) => {
    // Every recipe-scoped route decides through here, so a follower can open, like, save,
    // rate and comment on a private account's recipe without any route changing.
    const db = mockDb({ post: postBy(true), followerIds: [FOLLOWER_ID] });

    await expect(canSeePost(db as never, POST_ID, viewerId)).resolves.toEqual({
      status: 'ok',
      authorId: OWNER_ID,
    });
  });

  it.each([
    ['someone else', STRANGER_ID],
    ['a signed-out viewer', null],
  ])('lets %s into a public recipe', async (_who, viewerId) => {
    const db = mockDb({ post: postBy(false) });

    await expect(canSeePost(db as never, POST_ID, viewerId)).resolves.toEqual({
      status: 'ok',
      authorId: OWNER_ID,
    });
  });
});

describe('deniedPostResponse', () => {
  it('answers a missing recipe with 404 recipe.notFound', async () => {
    const response = deniedPostResponse({ status: 'notFound' });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: 'Recipe not found',
      code: 'recipe.notFound',
    });
  });

  it('answers a private recipe with 403 user.profilePrivate and the author, nothing else', async () => {
    // The same code GET /api/recipes/[id] sends, so the client handles both alike; the
    // username lets it link to the profile. No title, no counts, no rating.
    const response = deniedPostResponse({ status: 'private', authorUsername: 'chef_owner' });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: 'This profile is private',
      code: 'user.profilePrivate',
      author: { username: 'chef_owner' },
    });
  });

  it('sends JSON', () => {
    const response = deniedPostResponse({ status: 'notFound' });

    expect(response.headers.get('content-type')).toMatch(/^application\/json/);
  });
});
