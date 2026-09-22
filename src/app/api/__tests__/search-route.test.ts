/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

jest.mock('@/lib/database/prisma', () => ({
  __esModule: true,
  default: {
    post: { findMany: jest.fn() },
    // The four tables loadViewerState reads for a signed-in reader.
    like: { findMany: jest.fn() },
    savedRecipe: { findMany: jest.fn() },
    cookedRecipe: { groupBy: jest.fn() },
    rating: { findMany: jest.fn() },
  },
}));

jest.mock('@/lib/api/auth', () => ({ getCurrentUser: jest.fn() }));

jest.mock('@/lib/container/container', () => ({ container: { get: jest.fn() } }));

import { getCurrentUser } from '@/lib/api/auth';
import { container } from '@/lib/container/container';
import prisma from '@/lib/database/prisma';
import { GET } from '../search/route';
import { admits, type PostRow } from './helpers/postWhere';

/**
 * GET /api/search, the search page's endpoint. (search.test.ts is about the feed's `?q=`.)
 *
 * Who finds a private account's recipes by searching. It used to be nobody, the author
 * included, and the reader was resolved only after the query, too late to count.
 */

const OWNER = '11111111-1111-4111-8111-111111111111'; // keeps a private account
const STRANGER = '22222222-2222-4222-8222-222222222222';
const PUBLIC_AUTHOR = '33333333-3333-4333-8333-333333333333';

function post(id: string, userId: string, title: string, isPrivate: boolean): PostRow {
  return {
    id,
    userId,
    title,
    description: null,
    imageUrl: 'https://res.cloudinary.com/demo/image/upload/dish.jpg',
    difficulty: 'easy',
    prepTime: 10,
    cookingTime: 30,
    servings: 2,
    averageRating: null,
    reviewCount: 0,
    createdAt: new Date('2026-01-01'),
    user: { username: `u-${userId.slice(0, 4)}`, avatar: null, isPrivate },
    _count: { likes: 0, comments: 0 },
  };
}

const ROWS = [
  post('public-tomato', PUBLIC_AUTHOR, 'Tomato soup', false),
  post('private-tomato', OWNER, 'Tomato pie', true),
  post('public-lemon', PUBLIC_AUTHOR, 'Lemon cake', false),
];

beforeEach(() => {
  jest.clearAllMocks();
  (container.get as jest.Mock).mockReturnValue({ searchUsers: jest.fn().mockResolvedValue([]) });
  // The mocked database answers with the rows the route's own `where` admits.
  (prisma.post.findMany as jest.Mock).mockImplementation(({ where }) =>
    Promise.resolve(ROWS.filter((row) => admits(where, row)))
  );
  (prisma.like.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.savedRecipe.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.cookedRecipe.groupBy as jest.Mock).mockResolvedValue([]);
  (prisma.rating.findMany as jest.Mock).mockResolvedValue([]);
});

describe("GET /api/search — a private account's recipes", () => {
  it.each<[string, string | null, string[]]>([
    ['the author themself', OWNER, ['public-tomato', 'private-tomato']],
    ['someone else', STRANGER, ['public-tomato']],
    ['a signed-out reader', null, ['public-tomato']],
  ])('are found by the author only — asked by %s', async (_who, viewer, expected) => {
    (getCurrentUser as jest.Mock).mockResolvedValue(viewer ? { id: viewer } : null);

    const response = await GET(new NextRequest('http://localhost:3000/api/search?q=tomato'));
    const body = await response.json();

    expect(response.status).toBe(200);
    // The lemon cake never comes back: the text search and the rule are both ORs, and here
    // they stand side by side rather than one replacing the other.
    expect(body.recipes.map((r: { id: string }) => r.id)).toEqual(expected);
  });
});
