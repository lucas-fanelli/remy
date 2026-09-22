/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

jest.mock('@/lib/database/prisma', () => ({
  __esModule: true,
  default: {
    post: { findMany: jest.fn(), count: jest.fn() },
    // The four tables loadViewerState reads for a signed-in reader.
    like: { findMany: jest.fn() },
    savedRecipe: { findMany: jest.fn() },
    cookedRecipe: { groupBy: jest.fn() },
    rating: { findMany: jest.fn() },
  },
}));

jest.mock('@/lib/api/auth', () => ({ getCurrentUser: jest.fn(), requireAuth: jest.fn() }));

import { getCurrentUser } from '@/lib/api/auth';
import prisma from '@/lib/database/prisma';
import { GET } from '../recipes/route';
import { admits, type PostRow } from './helpers/postWhere';

/**
 * Who sees a private account's recipes in the feed. It used to be nobody — the filter was
 * "public authors only", so a private author could not find their own recipes — and the
 * viewer was resolved only after the query, too late to count.
 */

const OWNER = '11111111-1111-4111-8111-111111111111'; // keeps a private account
const STRANGER = '22222222-2222-4222-8222-222222222222';
const PUBLIC_AUTHOR = '33333333-3333-4333-8333-333333333333';

function post(id: string, userId: string, title: string, isPrivate: boolean): PostRow {
  return {
    id,
    userId,
    title,
    description: `${title}, step by step`,
    imageUrl: 'https://res.cloudinary.com/demo/image/upload/dish.jpg',
    cookingTime: 30,
    prepTime: 10,
    servings: 2,
    difficulty: 'easy',
    ingredients: [],
    instructions: [],
    caption: null,
    averageRating: null,
    reviewCount: 0,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    user: {
      id: userId,
      username: `u-${userId.slice(0, 4)}`,
      fullName: null,
      avatar: null,
      isPrivate,
    },
    _count: { likes: 0, comments: 0 },
  };
}

const ROWS = [
  post('public-tomato', PUBLIC_AUTHOR, 'Tomato soup', false),
  post('private-tomato', OWNER, 'Tomato pie', true),
  post('public-lemon', PUBLIC_AUTHOR, 'Lemon cake', false),
];

function asViewer(viewerId: string | null) {
  (getCurrentUser as jest.Mock).mockResolvedValue(viewerId ? { id: viewerId } : null);
}

async function feed(query = '') {
  const response = await GET(new NextRequest(`http://localhost:3000/api/recipes${query}`));
  const body = await response.json();
  return { status: response.status, ids: body.recipes?.map((r: { id: string }) => r.id), body };
}

beforeEach(() => {
  jest.clearAllMocks();
  // The mocked database answers with the rows the route's own `where` admits.
  (prisma.post.findMany as jest.Mock).mockImplementation(({ where }) =>
    Promise.resolve(ROWS.filter((row) => admits(where, row)))
  );
  (prisma.post.count as jest.Mock).mockImplementation(({ where }) =>
    Promise.resolve(ROWS.filter((row) => admits(where, row)).length)
  );
  (prisma.like.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.savedRecipe.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.cookedRecipe.groupBy as jest.Mock).mockResolvedValue([]);
  (prisma.rating.findMany as jest.Mock).mockResolvedValue([]);
});

describe("GET /api/recipes — a private account's recipes", () => {
  it.each<[string, string | null, string[]]>([
    ['the author themself', OWNER, ['public-tomato', 'private-tomato', 'public-lemon']],
    ['someone else', STRANGER, ['public-tomato', 'public-lemon']],
    ['a signed-out reader', null, ['public-tomato', 'public-lemon']],
  ])('are listed and counted for the author only — asked by %s', async (_who, viewer, expected) => {
    asViewer(viewer);

    const { status, ids, body } = await feed();

    expect(status).toBe(200);
    expect(ids).toEqual(expected);
    // The count runs on the same filter: a total that included hidden recipes would say
    // they exist, and hasMore would promise a page that never comes.
    expect(body.total).toBe(expected.length);
  });

  it.each<[string, string | null, string[]]>([
    ['the author themself', OWNER, ['public-tomato', 'private-tomato']],
    ['someone else', STRANGER, ['public-tomato']],
    ['a signed-out reader', null, ['public-tomato']],
  ])('keep the text search beside the rule — asked by %s', async (_who, viewer, expected) => {
    // Both the text search and the rule are ORs. If one replaced the other, the lemon cake
    // would come back for everyone, or the private pie would come back for strangers.
    asViewer(viewer);

    const { ids } = await feed('?q=tomato');

    expect(ids).toEqual(expected);
  });

  it('are listed by ?userId= for the author, and for nobody else', async () => {
    asViewer(OWNER);
    expect((await feed(`?userId=${OWNER}`)).ids).toEqual(['private-tomato']);

    asViewer(STRANGER);
    expect((await feed(`?userId=${OWNER}`)).ids).toEqual([]);
  });
});
