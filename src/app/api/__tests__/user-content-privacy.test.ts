/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

/**
 * The four routes that serve one account's content by username — its followers, who it
 * follows, its counts and its recipes — and the gate in front of each. All four decide
 * through canViewContentOf, so S3 lets an accepted follower into all of them by changing
 * visibility.ts alone.
 */

jest.mock('@/lib/database/prisma', () => ({
  __esModule: true,
  default: {
    follow: { findMany: jest.fn(), count: jest.fn() },
    post: { findMany: jest.fn(), count: jest.fn() },
  },
}));

jest.mock('@/lib/api/auth', () => ({ verifySessionToken: jest.fn() }));

const mockGetUserByUsername = jest.fn();
jest.mock('@/lib/container/container', () => ({
  container: { getUserService: () => ({ getUserByUsername: mockGetUserByUsername }) },
}));

// The real rule, wrapped so a test can check each route asks it rather than deciding alone.
jest.mock('@/lib/privacy/visibility', () => {
  const actual = jest.requireActual('@/lib/privacy/visibility');
  return { ...actual, canViewContentOf: jest.fn(actual.canViewContentOf) };
});

import { verifySessionToken } from '@/lib/api/auth';
import prisma from '@/lib/database/prisma';
import { canViewContentOf } from '@/lib/privacy/visibility';
import { GET as followersGET } from '../users/[username]/followers/route';
import { GET as followingGET } from '../users/[username]/following/route';
import { GET as recipesGET } from '../users/[username]/recipes/route';
import { GET as statsGET } from '../users/[username]/stats/route';

const { canViewContentOf: realCanViewContentOf } = jest.requireActual('@/lib/privacy/visibility');

const OWNER_ID = 'owner-1';
const STRANGER_ID = 'stranger-1';

const PERSON = { id: 'person-9', username: 'fan', fullName: 'A Fan', avatar: null, bio: null };

/** The account as UserService.getUserByUsername returns it (no password). */
function account(isPrivate: boolean) {
  return {
    id: OWNER_ID,
    email: 'chef@example.com',
    username: 'chef',
    fullName: 'Chef Owner',
    bio: null,
    avatar: null,
    website: null,
    isPrivate,
    isVerified: false,
    role: 'user',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };
}

type Handler = (
  request: NextRequest,
  context: { params: Promise<{ username: string }> }
) => Promise<Response>;

interface RouteCase {
  path: string;
  GET: Handler;
  /** What a signed-out visitor gets for a private account: the lists ask for a session first. */
  signedOut: 401 | 403;
  /** Answer the route's content queries. */
  serve: () => void;
  /** What the route sends once it is let in. */
  content: Record<string, unknown>;
}

const ROUTES: RouteCase[] = [
  {
    path: 'followers',
    GET: followersGET,
    signedOut: 401,
    serve: () => {
      (prisma.follow.findMany as jest.Mock)
        .mockResolvedValueOnce([{ follower: PERSON }]) // the page of followers
        .mockResolvedValueOnce([]); // which of them the viewer follows
      (prisma.follow.count as jest.Mock).mockResolvedValue(1);
    },
    content: { followers: [{ ...PERSON, isFollowing: false }], total: 1 },
  },
  {
    path: 'following',
    GET: followingGET,
    signedOut: 401,
    serve: () => {
      (prisma.follow.findMany as jest.Mock)
        .mockResolvedValueOnce([{ following: PERSON }])
        .mockResolvedValueOnce([]);
      (prisma.follow.count as jest.Mock).mockResolvedValue(1);
    },
    content: { following: [{ ...PERSON, isFollowing: false }], total: 1 },
  },
  {
    path: 'stats',
    GET: statsGET,
    signedOut: 403,
    serve: () => {
      (prisma.post.count as jest.Mock).mockResolvedValue(4);
      (prisma.follow.count as jest.Mock).mockResolvedValueOnce(5).mockResolvedValueOnce(6);
    },
    content: { recipesCount: 4, followersCount: 5, followingCount: 6 },
  },
  {
    path: 'recipes',
    GET: recipesGET,
    signedOut: 403,
    serve: () => {
      (prisma.post.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'post-1',
          title: 'Secret stew',
          description: null,
          imageUrl: 'https://res.cloudinary.com/demo/image/upload/stew.jpg',
          difficulty: 'easy',
          cookingTime: 30,
          prepTime: 10,
          servings: 2,
          createdAt: new Date('2026-02-01T00:00:00Z'),
          _count: { likes: 1, comments: 0 },
        },
      ]);
      (prisma.post.count as jest.Mock).mockResolvedValue(1);
    },
    content: {
      recipes: [expect.objectContaining({ id: 'post-1', title: 'Secret stew' })],
      total: 1,
    },
  },
];

/** A request from `viewerId`, or from nobody when it is null. */
function requestAs(path: string, viewerId: string | null): NextRequest {
  const url = `http://localhost:3000/api/users/chef/${path}`;
  if (viewerId === null) return new NextRequest(url);
  (verifySessionToken as jest.Mock).mockResolvedValue({
    userId: viewerId,
    email: `${viewerId}@example.com`,
    username: viewerId,
    role: 'user',
  });
  return new NextRequest(url, { headers: { cookie: `auth_token=token-of-${viewerId}` } });
}

const context = { params: Promise.resolve({ username: 'chef' }) };

function expectNoContentRead() {
  expect(prisma.follow.findMany).not.toHaveBeenCalled();
  expect(prisma.follow.count).not.toHaveBeenCalled();
  expect(prisma.post.findMany).not.toHaveBeenCalled();
  expect(prisma.post.count).not.toHaveBeenCalled();
}

beforeEach(() => {
  // resetAllMocks, not clearAllMocks: the content queries are queued with
  // mockResolvedValueOnce, and a queue a denied request never drained must not answer the
  // next test.
  jest.resetAllMocks();
  (canViewContentOf as jest.Mock).mockImplementation(realCanViewContentOf);
});

describe.each(ROUTES)(
  'GET /api/users/[username]/$path',
  ({ path, GET, signedOut, serve, content }) => {
    describe('a private account', () => {
      beforeEach(() => {
        mockGetUserByUsername.mockResolvedValue(account(true));
        serve();
      });

      it('refuses a stranger with 403 user.profilePrivate, and reads none of it', async () => {
        const response = await GET(requestAs(path, STRANGER_ID), context);

        expect(response.status).toBe(403);
        expect(await response.json()).toEqual({
          error: 'This profile is private',
          code: 'user.profilePrivate',
        });
        expectNoContentRead();
      });

      it(`refuses a signed-out visitor with ${signedOut}, and reads none of it`, async () => {
        const response = await GET(requestAs(path, null), context);

        expect(response.status).toBe(signedOut);
        expectNoContentRead();
      });

      it('serves the owner', async () => {
        const response = await GET(requestAs(path, OWNER_ID), context);

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual(content);
      });

      it('lets in whoever the shared rule lets in', async () => {
        // Stands in for S3, where the rule also admits an accepted follower: the change is
        // made in visibility.ts alone, and this route has to follow it.
        (canViewContentOf as jest.Mock).mockResolvedValueOnce(true);

        const response = await GET(requestAs(path, STRANGER_ID), context);

        expect(canViewContentOf).toHaveBeenCalledWith(
          prisma,
          STRANGER_ID,
          expect.objectContaining({ id: OWNER_ID, isPrivate: true })
        );
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual(content);
      });
    });

    it('serves a public account to someone else', async () => {
      mockGetUserByUsername.mockResolvedValue(account(false));
      serve();

      const response = await GET(requestAs(path, STRANGER_ID), context);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(content);
    });

    it('answers 404 user.notFound for an account that does not exist', async () => {
      mockGetUserByUsername.mockResolvedValue(null);

      const response = await GET(requestAs(path, STRANGER_ID), context);

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: 'User not found', code: 'user.notFound' });
      expectNoContentRead();
    });
  }
);
