/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

jest.mock('@/lib/database/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    post: { findMany: jest.fn() },
    savedRecipe: { findMany: jest.fn() },
  },
}));

jest.mock('@/lib/api/auth', () => ({ verifySessionToken: jest.fn() }));

// What the viewer did to each card is covered by viewerState's own tests; here it only has
// to answer.
jest.mock('@/lib/api/viewerState', () => ({ loadViewerState: jest.fn(async () => () => null) }));

// Where the viewer stands with the account. How it is derived — a follow outranks a
// request, a request to a public account counts for nothing — is state.test.ts's; here each
// test says what it is, and checks the route both shows it and decides by it.
jest.mock('@/lib/follows/state', () => ({ followStateOf: jest.fn() }));

// The real rule, wrapped so a test can check the route asks it rather than deciding alone.
jest.mock('@/lib/privacy/visibility', () => {
  const actual = jest.requireActual('@/lib/privacy/visibility');
  return { ...actual, canViewContent: jest.fn(actual.canViewContent) };
});

import { verifySessionToken } from '@/lib/api/auth';
import { loadViewerState } from '@/lib/api/viewerState';
import prisma from '@/lib/database/prisma';
import { followStateOf } from '@/lib/follows/state';
import { canViewContent, visiblePostsWhere } from '@/lib/privacy/visibility';
import { GET } from '../users/[username]/profile/route';
import type { FollowState } from '@/domain/types/follow';

const { canViewContent: realCanViewContent } = jest.requireActual('@/lib/privacy/visibility');

const OWNER_ID = 'owner-1';
const STRANGER_ID = 'stranger-1';

const STATS = { recipesCount: 1, followersCount: 2, followingCount: 3 };

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

/** Where the viewer stands with the account, as src/lib/follows/state.ts would say. */
function viewerStands(state: FollowState) {
  (followStateOf as jest.Mock).mockResolvedValue(state);
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
  // clearAllMocks keeps a queued mockReturnValueOnce; a test that queued one and was never
  // asked must not hand it to the next test.
  (canViewContent as jest.Mock).mockReset().mockImplementation(realCanViewContent);
  (followStateOf as jest.Mock).mockReset().mockResolvedValue('none');
  (prisma.post.findMany as jest.Mock).mockResolvedValue([RECIPE]);
  (prisma.savedRecipe.findMany as jest.Mock).mockResolvedValue([]);
});

describe('GET /api/users/[username]/profile — a private account', () => {
  beforeEach(() => {
    accountLookupFinds(true);
  });

  // The locked view is the header: the person, the three counts and where the viewer
  // stands — nothing of the recipes. The recipes used to be selected inside the account
  // lookup itself and thrown away afterwards, so "no recipe query ran" held even then; what
  // proves they are no longer read is the lookup's own select.
  const LOCKED = {
    user: {
      id: OWNER_ID,
      username: 'chef',
      fullName: 'Chef Owner',
      avatar: null,
      bio: 'Stews, mostly',
      isPrivate: true,
    },
    stats: STATS,
    recipes: [],
    isOwnProfile: false,
    isPrivateProfile: true,
  };

  function expectNoRecipesRead() {
    expect(accountQuery().select).not.toHaveProperty('posts');
    expect(prisma.post.findMany).not.toHaveBeenCalled();
    expect(prisma.savedRecipe.findMany).not.toHaveBeenCalled();
    expect(loadViewerState).not.toHaveBeenCalled();
  }

  it('shows a stranger the header and the counts, offers to follow, and never reads the recipes', async () => {
    const response = await GET(requestAs(STRANGER_ID), context);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ...LOCKED, followState: 'none' });
    expect(followStateOf).toHaveBeenCalledWith(prisma, STRANGER_ID, OWNER_ID);
    expectNoRecipesRead();
  });

  it('shows someone whose request is pending that it is, and still no recipes', async () => {
    // "Solicitado" on the button, and a request opens nothing.
    viewerStands('requested');

    const response = await GET(requestAs(STRANGER_ID), context);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ...LOCKED, followState: 'requested' });
    expectNoRecipesRead();
  });

  it('shows a signed-out visitor the same locked view, with no follow state', async () => {
    const response = await GET(requestAs(null), context);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ...LOCKED, followState: null });
    expect(verifySessionToken).not.toHaveBeenCalled();
    expect(followStateOf).not.toHaveBeenCalled();
    expectNoRecipesRead();
  });

  it('lets an accepted follower in: the recipes, the website, and that they follow', async () => {
    viewerStands('following');

    const response = await GET(requestAs(STRANGER_ID), context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.isPrivateProfile).toBeUndefined();
    expect(prisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: OWNER_ID } })
    );
    expect(body.recipes).toEqual([expect.objectContaining({ id: 'post-1' })]);
    expect(body.stats).toEqual(STATS);
    expect(body.user).toEqual(
      expect.objectContaining({ isPrivate: true, website: 'https://chef.example' })
    );
    expect(body.followState).toBe('following');
    expect(body.isFollowing).toBe(true);
    // Their own profile only
    expect(body.savedRecipes).toBeUndefined();
  });

  it('decides through the shared rule, handing it whether the viewer follows', async () => {
    // The follow state is read once, for the button, and passed on: the rule is not
    // re-derived here, and the follow row is not read a second time.
    (canViewContent as jest.Mock).mockReturnValueOnce(true);

    const response = await GET(requestAs(STRANGER_ID), context);
    const body = await response.json();

    expect(canViewContent).toHaveBeenCalledWith(
      STRANGER_ID,
      expect.objectContaining({ id: OWNER_ID, isPrivate: true }),
      false
    );
    expect(body.isPrivateProfile).toBeUndefined();
    expect(body.recipes).toEqual([expect.objectContaining({ id: 'post-1' })]);
  });

  it('shows the owner their recipes, their counts and their website, and no follow button', async () => {
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
    expect(body.stats).toEqual(STATS);
    expect(body.user.website).toBe('https://chef.example');
    expect(body.user.isPrivate).toBe(true);
    expect(body.followState).toBeNull();
    expect(body).not.toHaveProperty('isFollowing');
    expect(followStateOf).not.toHaveBeenCalled();
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

  it.each<[FollowState, boolean]>([
    ['following', true],
    ['none', false],
  ])('shows a stranger the recipes, and that they stand at %p', async (state, isFollowing) => {
    viewerStands(state);

    const response = await GET(requestAs(STRANGER_ID), context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.recipes).toEqual([expect.objectContaining({ id: 'post-1' })]);
    expect(body.isOwnProfile).toBe(false);
    expect(body.user.isPrivate).toBe(false);
    expect(body.followState).toBe(state);
    // Kept for a tab still running the bundle from before followState
    expect(body.isFollowing).toBe(isFollowing);
    expect(followStateOf).toHaveBeenCalledWith(prisma, STRANGER_ID, OWNER_ID);
  });

  it('reads the recipes alongside the follow state, not after it', async () => {
    // A public profile is visible whatever the follow state says, so waiting for it before
    // asking for the recipes only added a round trip to the most visited route.
    let answerFollowState: (state: FollowState) => void = () => {};
    (followStateOf as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        answerFollowState = resolve;
      })
    );

    const pending = GET(requestAs(STRANGER_ID), context);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(prisma.post.findMany).toHaveBeenCalled();
    answerFollowState('none');
    expect((await pending).status).toBe(200);
  });

  it('shows a signed-out visitor the recipes, and no follow state', async () => {
    const response = await GET(requestAs(null), context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.recipes).toEqual([expect.objectContaining({ id: 'post-1' })]);
    expect(body.followState).toBeNull();
    expect(body).not.toHaveProperty('isFollowing');
    expect(followStateOf).not.toHaveBeenCalled();
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
  expect(followStateOf).not.toHaveBeenCalled();
  expect(prisma.post.findMany).not.toHaveBeenCalled();
});
