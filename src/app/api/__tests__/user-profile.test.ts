/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

jest.mock('@/lib/database/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    post: { findMany: jest.fn() },
    follow: { findUnique: jest.fn() },
    savedRecipe: { findMany: jest.fn() },
  },
}));

jest.mock('@/lib/api/auth', () => ({ verifySessionToken: jest.fn() }));

// What the viewer did to each card is covered by viewerState's own tests; here it only has
// to answer.
jest.mock('@/lib/api/viewerState', () => ({ loadViewerState: jest.fn(async () => () => null) }));

// The real rule, wrapped so a test can check the route asks it rather than deciding alone.
jest.mock('@/lib/privacy/visibility', () => {
  const actual = jest.requireActual('@/lib/privacy/visibility');
  return { ...actual, canViewContentOf: jest.fn(actual.canViewContentOf) };
});

import { verifySessionToken } from '@/lib/api/auth';
import { loadViewerState } from '@/lib/api/viewerState';
import prisma from '@/lib/database/prisma';
import { canViewContentOf, visiblePostsWhere } from '@/lib/privacy/visibility';
import { GET } from '../users/[username]/profile/route';

const { canViewContentOf: realCanViewContentOf } = jest.requireActual('@/lib/privacy/visibility');

const OWNER_ID = 'owner-1';
const STRANGER_ID = 'stranger-1';

/** The account row as the first query selects it: the header and the three counts. */
function account(isPrivate: boolean) {
  return {
    id: OWNER_ID,
    username: 'chef',
    fullName: 'Chef Owner',
    bio: 'Stews, mostly',
    avatar: null,
    website: 'https://chef.example',
    isPrivate,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    _count: { posts: 1, followers: 2, following: 3 },
  };
}

const RECIPE = {
  id: 'post-1',
  title: 'Secret stew',
  description: 'Only for the owner',
  imageUrl: 'https://res.cloudinary.com/demo/image/upload/stew.jpg',
  difficulty: 'easy',
  cookingTime: 30,
  prepTime: 10,
  servings: 2,
  averageRating: 4.5,
  reviewCount: 2,
  createdAt: new Date('2026-02-01T00:00:00Z'),
  _count: { likes: 1, comments: 0 },
};

/**
 * Answers the account lookup as Prisma would: with the recipes only if the select asks for
 * them. The route used to ask, and answering that too means a run against the old route
 * fails on what each test checks rather than on a crash.
 */
function accountLookupFinds(isPrivate: boolean) {
  (prisma.user.findUnique as jest.Mock).mockImplementation(
    async (args: { select: Record<string, unknown> }) => ({
      ...account(isPrivate),
      ...('posts' in args.select ? { posts: [RECIPE] } : {}),
    })
  );
}

/** A request from `viewerId`, or from nobody when it is null. */
function requestAs(viewerId: string | null, query = ''): NextRequest {
  if (viewerId === null) {
    return new NextRequest(`http://localhost:3000/api/users/chef/profile${query}`);
  }
  (verifySessionToken as jest.Mock).mockResolvedValue({
    userId: viewerId,
    email: `${viewerId}@example.com`,
    username: viewerId,
    role: 'user',
  });
  return new NextRequest(`http://localhost:3000/api/users/chef/profile${query}`, {
    headers: { cookie: `auth_token=token-of-${viewerId}` },
  });
}

const context = { params: Promise.resolve({ username: 'chef' }) };

/** The arguments of the one query every request makes: the account lookup. */
const accountQuery = () => (prisma.user.findUnique as jest.Mock).mock.calls[0][0];

beforeEach(() => {
  jest.clearAllMocks();
  // clearAllMocks keeps a queued mockResolvedValueOnce; a test that queued one and was never
  // asked must not hand it to the next test.
  (canViewContentOf as jest.Mock).mockReset().mockImplementation(realCanViewContentOf);
  (prisma.post.findMany as jest.Mock).mockResolvedValue([RECIPE]);
  (prisma.follow.findUnique as jest.Mock).mockResolvedValue(null);
  (prisma.savedRecipe.findMany as jest.Mock).mockResolvedValue([]);
});

describe('GET /api/users/[username]/profile — a private account', () => {
  beforeEach(() => {
    accountLookupFinds(true);
  });

  // The locked view is the person and nothing of their recipes. The recipes used to be
  // selected inside the account lookup itself and thrown away afterwards, so "no recipe
  // query ran" held even then; what proves they are no longer read is the lookup's own
  // select.
  const LOCKED = {
    user: {
      id: OWNER_ID,
      username: 'chef',
      fullName: 'Chef Owner',
      avatar: null,
      bio: 'Stews, mostly',
      isPrivate: true,
    },
    recipes: [],
    isOwnProfile: false,
    isPrivateProfile: true,
  };

  it('shows a stranger the header only, and never reads the recipes', async () => {
    const response = await GET(requestAs(STRANGER_ID), context);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(LOCKED);
    expect(accountQuery().select).not.toHaveProperty('posts');
    expect(prisma.post.findMany).not.toHaveBeenCalled();
    expect(prisma.savedRecipe.findMany).not.toHaveBeenCalled();
    expect(loadViewerState).not.toHaveBeenCalled();
  });

  it('shows a signed-out visitor the same locked view', async () => {
    const response = await GET(requestAs(null), context);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(LOCKED);
    expect(verifySessionToken).not.toHaveBeenCalled();
    expect(accountQuery().select).not.toHaveProperty('posts');
    expect(prisma.post.findMany).not.toHaveBeenCalled();
  });

  it('shows the owner their recipes, their counts and their website', async () => {
    const response = await GET(requestAs(OWNER_ID), context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(prisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: OWNER_ID },
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0,
      })
    );
    expect(body.isOwnProfile).toBe(true);
    expect(body.isPrivateProfile).toBeUndefined();
    expect(body.recipes).toEqual([
      expect.objectContaining({ id: 'post-1', title: 'Secret stew', likeCount: 1 }),
    ]);
    expect(body.stats).toEqual({ recipesCount: 1, followersCount: 2, followingCount: 3 });
    expect(body.user.website).toBe('https://chef.example');
  });

  it('lets in whoever the shared rule lets in', async () => {
    // Stands in for S3, where the rule also admits an accepted follower: the change is made
    // in visibility.ts alone, and this route has to follow it rather than decide by itself.
    (canViewContentOf as jest.Mock).mockResolvedValueOnce(true);

    const response = await GET(requestAs(STRANGER_ID), context);
    const body = await response.json();

    expect(canViewContentOf).toHaveBeenCalledWith(
      prisma,
      STRANGER_ID,
      expect.objectContaining({ id: OWNER_ID, isPrivate: true })
    );
    expect(body.isPrivateProfile).toBeUndefined();
    expect(body.recipes).toEqual([expect.objectContaining({ id: 'post-1' })]);
  });
});

describe('GET /api/users/[username]/profile — the saved tab', () => {
  it('lists only the saves whose recipe the owner can still see', async () => {
    // A recipe saved before its author went private drops out of the tab. It stays saved,
    // and comes back if access does.
    accountLookupFinds(false);

    const response = await GET(requestAs(OWNER_ID), context);

    expect(response.status).toBe(200);
    expect(prisma.savedRecipe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: OWNER_ID, post: { AND: [visiblePostsWhere(OWNER_ID)] } },
      })
    );
  });

  it('is not read on anyone else’s profile', async () => {
    accountLookupFinds(false);

    const response = await GET(requestAs(STRANGER_ID), context);
    const body = await response.json();

    expect(prisma.savedRecipe.findMany).not.toHaveBeenCalled();
    expect(body.savedRecipes).toBeUndefined();
  });
});

describe('GET /api/users/[username]/profile — a public account', () => {
  beforeEach(() => {
    accountLookupFinds(false);
  });

  it('shows a stranger the recipes, and whether they follow the account', async () => {
    (prisma.follow.findUnique as jest.Mock).mockResolvedValue({ id: 'follow-1' });

    const response = await GET(requestAs(STRANGER_ID), context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.recipes).toEqual([expect.objectContaining({ id: 'post-1' })]);
    expect(body.isOwnProfile).toBe(false);
    expect(body.isFollowing).toBe(true);
  });

  it('shows a signed-out visitor the recipes', async () => {
    const response = await GET(requestAs(null), context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.recipes).toEqual([expect.objectContaining({ id: 'post-1' })]);
    expect(body.isFollowing).toBeUndefined();
  });

  it('pages the recipes by postsLimit and postsOffset', async () => {
    await GET(requestAs(STRANGER_ID, '?postsLimit=10&postsOffset=20'), context);

    expect(prisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10, skip: 20 })
    );
  });
});

it('answers 404 for an account that does not exist, and reads nothing else', async () => {
  (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

  const response = await GET(requestAs(STRANGER_ID), context);

  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ error: 'User not found', code: 'user.notFound' });
  expect(prisma.post.findMany).not.toHaveBeenCalled();
});
