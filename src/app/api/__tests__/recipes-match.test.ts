/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

// One object is both `prisma` and the `tx` its $transaction hands the callback, so the
// route's two transactions and its own queries all land on these mocks.
jest.mock('@/lib/database/prisma', () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn(),
    $executeRaw: jest.fn(),
    $queryRaw: jest.fn(),
    userPantry: { findUnique: jest.fn() },
    post: { findMany: jest.fn() },
    // The four tables loadViewerState reads for a signed-in reader.
    like: { findMany: jest.fn() },
    savedRecipe: { findMany: jest.fn() },
    cookedRecipe: { groupBy: jest.fn() },
    rating: { findMany: jest.fn() },
  },
}));

jest.mock('@/lib/api/auth', () => ({ requireAuth: jest.fn() }));

import { requireAuth } from '@/lib/api/auth';
import prisma from '@/lib/database/prisma';
import { admits, type PostRow } from './helpers/postWhere';
import { GET } from '../recipes/match/route';

/**
 * Whose recipes the pantry match may suggest. It used to be public authors only, at all
 * three places the route reads posts, so a private author never matched their own recipes
 * against their own pantry.
 */

const VIEWER = '11111111-1111-4111-8111-111111111111'; // keeps a private account
const OTHER_PRIVATE = '22222222-2222-4222-8222-222222222222';
const PUBLIC_AUTHOR = '33333333-3333-4333-8333-333333333333';

function post(id: string, userId: string, isPrivate: boolean): PostRow {
  return {
    id,
    userId,
    title: 'Tomato and onion salad',
    description: null,
    imageUrl: 'https://res.cloudinary.com/demo/image/upload/dish.jpg',
    difficulty: 'easy',
    cookingTime: 10,
    prepTime: 5,
    servings: 2,
    ingredients: [
      { name: 'tomato', amount: '2', unit: 'u' },
      { name: 'onion', amount: '1', unit: 'u' },
    ],
    user: { id: userId, username: `u-${userId.slice(0, 4)}`, avatar: null, isPrivate },
    _count: { likes: 0, comments: 0 },
  };
}

const ROWS = [
  post('public-salad', PUBLIC_AUTHOR, false),
  post('own-private-salad', VIEWER, true),
  post('other-private-salad', OTHER_PRIVATE, true),
];

function pantryOf(...names: string[]) {
  (prisma.userPantry.findUnique as jest.Mock).mockResolvedValue({
    items: names.map((name) => ({ name })),
  });
}

/** The raw candidate query, as PostgreSQL receives it: text with $1, $2… and the values. */
function candidateQuery(): { text: string; values: unknown[] } | undefined {
  const call = (prisma.$queryRaw as jest.Mock).mock.calls.find(([strings]) =>
    strings.join('').includes('FROM "posts"')
  );
  if (!call) return undefined;
  const [strings, ...values] = call as [TemplateStringsArray, ...unknown[]];
  return { text: strings.reduce((sql, part, i) => `${sql}$${i}${part}`), values };
}

async function match() {
  const response = await GET(new NextRequest('http://localhost:3000/api/recipes/match'));
  return { status: response.status, body: await response.json() };
}

beforeEach(() => {
  jest.clearAllMocks();
  (requireAuth as jest.Mock).mockResolvedValue({ id: VIEWER });
  (prisma.$transaction as jest.Mock).mockImplementation((fn) => fn(prisma));
  (prisma.$executeRaw as jest.Mock).mockResolvedValue(0);
  // The advisory lock is granted; the candidate query lets every row through, as if its SQL
  // filtered nothing, so what phase 3 returns is phase 3's own filter at work.
  (prisma.$queryRaw as jest.Mock).mockImplementation((strings: TemplateStringsArray) =>
    Promise.resolve(
      strings.join('').includes('pg_try_advisory_xact_lock')
        ? [{ locked: true }]
        : ROWS.map(({ id, ingredients }) => ({ id, ingredients }))
    )
  );
  (prisma.post.findMany as jest.Mock).mockImplementation(({ where }) =>
    Promise.resolve(ROWS.filter((row) => admits(where, row)))
  );
  (prisma.like.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.savedRecipe.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.cookedRecipe.groupBy as jest.Mock).mockResolvedValue([]);
  (prisma.rating.findMany as jest.Mock).mockResolvedValue([]);
  pantryOf('tomato', 'onion');
});

describe('GET /api/recipes/match — whose recipes it suggests', () => {
  it("asks the candidate query for public authors or the viewer's own recipes", async () => {
    await match();

    const query = candidateQuery();
    expect(query).toBeDefined();
    // Parenthesised, so the ANDs after it hold for both arms; and the id compared is the
    // signed-in viewer's, bound as a parameter.
    const arm = query!.text.match(
      /WHERE\s+\(u\."isPrivate"\s*=\s*false\s+OR\s+p\."userId"\s*=\s*\$(\d+)\)/
    );
    expect(arm).not.toBeNull();
    expect(query!.values[Number(arm![1]) - 1]).toBe(VIEWER);
  });

  it("returns the viewer's own private recipe, and never another private account's", async () => {
    const { status, body } = await match();

    expect(status).toBe(200);
    const ids = [...body.readyToCook, ...body.almostThere, ...body.needMore].map(
      (r: { id: string }) => r.id
    );
    expect(ids).toEqual(['public-salad', 'own-private-salad']);
  });

  it('applies the same rule when the pantry has no name to search with', async () => {
    // "té" normalises to a single letter, too short for a LIKE pattern, so the route skips
    // the raw query and reads candidates through Prisma instead.
    pantryOf('té');

    await match();

    expect(candidateQuery()).toBeUndefined();
    const fallbackWhere = (prisma.post.findMany as jest.Mock).mock.calls[0][0].where;
    expect(ROWS.filter((row) => admits(fallbackWhere, row)).map((r) => r.id)).toEqual([
      'public-salad',
      'own-private-salad',
    ]);
  });
});
