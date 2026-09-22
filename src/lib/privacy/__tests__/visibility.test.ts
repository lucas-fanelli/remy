/**
 * @jest-environment node
 */
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

const publicOwner: ContentOwner = { id: OWNER_ID, isPrivate: false };
const privateOwner: ContentOwner = { id: OWNER_ID, isPrivate: true };

/** A stand-in for `prisma` or a transaction's `tx`: only the two tables the rule may read. */
function mockDb(post: unknown = null) {
  return {
    post: { findUnique: jest.fn().mockResolvedValue(post) },
    follow: { findUnique: jest.fn() },
  };
}

/**
 * Every viewer against every owner. A follower is not a row of this table yet: nothing
 * reads "follows" until S3, so a follower of a private account is still someone else.
 */
const TRUTH_TABLE: Array<
  [viewer: string, ownerKind: string, sees: boolean, viewerId: string | null, owner: ContentOwner]
> = [
  ['signed out', 'public', true, null, publicOwner],
  ['signed out', 'private', false, null, privateOwner],
  ['the owner', 'public', true, OWNER_ID, publicOwner],
  ['the owner', 'private', true, OWNER_ID, privateOwner],
  ['someone else', 'public', true, STRANGER_ID, publicOwner],
  ['someone else', 'private', false, STRANGER_ID, privateOwner],
];

describe('canViewContent', () => {
  it.each(TRUTH_TABLE)('%s, %s owner → sees: %p', (_viewer, _label, sees, viewerId, owner) => {
    expect(canViewContent(viewerId, owner)).toBe(sees);
  });
});

describe('canViewContentOf', () => {
  it.each(TRUTH_TABLE)(
    '%s, %s owner → sees: %p',
    async (_viewer, _label, sees, viewerId, owner) => {
      await expect(canViewContentOf(mockDb() as never, viewerId, owner)).resolves.toBe(sees);
    }
  );

  it('asks the database nothing when the owner row already decides', async () => {
    // Public owners, the owner themself and a signed-out viewer never need a follow lookup —
    // not now and not after S3, which adds one only for a private owner and a stranger.
    const db = mockDb();

    await canViewContentOf(db as never, STRANGER_ID, publicOwner);
    await canViewContentOf(db as never, OWNER_ID, privateOwner);
    await canViewContentOf(db as never, null, privateOwner);

    expect(db.follow.findUnique).not.toHaveBeenCalled();
    expect(db.post.findUnique).not.toHaveBeenCalled();
  });
});

describe('visiblePostsWhere', () => {
  it('shows a signed-out viewer only recipes by public authors', () => {
    expect(visiblePostsWhere(null)).toEqual({ user: { isPrivate: false } });
  });

  it('shows a signed-in viewer public authors plus their own recipes, private or not', () => {
    // The feed, search and matches used to filter on the public arm alone, which hid a
    // private author's own recipes from them.
    expect(visiblePostsWhere(STRANGER_ID)).toEqual({
      OR: [{ user: { isPrivate: false } }, { userId: STRANGER_ID }],
    });
  });

  it('hands every caller its own object', () => {
    // Callers nest it into a where they go on to build; a shared constant mutated by one
    // request would change the filter of the next.
    expect(visiblePostsWhere(null)).not.toBe(visiblePostsWhere(null));
    expect(visiblePostsWhere(STRANGER_ID)).not.toBe(visiblePostsWhere(STRANGER_ID));
  });
});

describe('canSeePost', () => {
  const POST_ID = 'post-1';
  const postBy = (isPrivate: boolean) => ({
    userId: OWNER_ID,
    user: { isPrivate, username: 'chef_owner' },
  });

  it('says notFound when there is no such recipe', async () => {
    const db = mockDb(null);

    await expect(canSeePost(db as never, POST_ID, STRANGER_ID)).resolves.toEqual({
      status: 'notFound',
    });
  });

  it('reads the recipe by id, and only its author', async () => {
    const db = mockDb(postBy(false));

    await canSeePost(db as never, POST_ID, STRANGER_ID);

    expect(db.post.findUnique).toHaveBeenCalledTimes(1);
    expect(db.post.findUnique).toHaveBeenCalledWith({
      where: { id: POST_ID },
      select: { userId: true, user: { select: { isPrivate: true, username: true } } },
    });
  });

  it.each([
    ['someone else', STRANGER_ID],
    ['a signed-out viewer', null],
  ])(
    'says private, with the author username, to %s on a private recipe',
    async (_who, viewerId) => {
      const db = mockDb(postBy(true));

      await expect(canSeePost(db as never, POST_ID, viewerId)).resolves.toEqual({
        status: 'private',
        authorUsername: 'chef_owner',
      });
    }
  );

  it('lets the author into their own private recipe, and returns their id', async () => {
    const db = mockDb(postBy(true));

    await expect(canSeePost(db as never, POST_ID, OWNER_ID)).resolves.toEqual({
      status: 'ok',
      authorId: OWNER_ID,
    });
  });

  it.each([
    ['someone else', STRANGER_ID],
    ['a signed-out viewer', null],
  ])('lets %s into a public recipe', async (_who, viewerId) => {
    const db = mockDb(postBy(false));

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
