/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

jest.mock('@/lib/database/prisma', () => ({
  __esModule: true,
  default: {
    cookedRecipe: { findMany: jest.fn(), count: jest.fn() },
    post: { findMany: jest.fn() },
  },
}));

jest.mock('@/lib/api/auth', () => ({ requireAuth: jest.fn() }));

import { requireAuth } from '@/lib/api/auth';
import prisma from '@/lib/database/prisma';
import { visiblePostsWhere } from '@/lib/privacy/visibility';
import { GET } from '../cooked-recipes/route';

/**
 * GET /api/cooked-recipes — the reader's own cooking history.
 *
 * The entries are the reader's and stay theirs. The recipe on each one belongs to its
 * author, who may have gone private since it was cooked; from then on the entry is kept but
 * the recipe is not sent. It used to be joined in whoever had written it, title, picture
 * and author included.
 */

const READER = 'reader-1';

const recipe = (id: string, title: string, username: string) => ({
  id,
  title,
  imageUrl: `https://res.cloudinary.com/demo/image/upload/${id}.jpg`,
  description: `${title}, paso a paso`,
  difficulty: 'easy',
  cookingTime: 20,
  prepTime: 10,
  user: { username, avatar: null },
});

// ana's account is public; bea made hers private after the reader cooked her stew.
const publicRecipe = recipe('post-public', 'Tortilla de papas', 'ana');
const privateRecipe = recipe('post-private', 'Guiso de la abuela', 'bea');
const RECIPES = [publicRecipe, privateRecipe];

const entry = (id: string, postId: string, cookedAt: string) => ({
  id,
  userId: READER,
  postId,
  cookedAt: new Date(cookedAt),
  deductedIngredients: null,
  restoredAt: null,
  deletedAt: null,
});

const ENTRIES = [
  entry('cook-2', privateRecipe.id, '2026-09-02T20:00:00Z'),
  entry('cook-1', publicRecipe.id, '2026-09-01T20:00:00Z'),
];

function getHistory(): Promise<Response> {
  return GET(new NextRequest('http://localhost:3000/api/cooked-recipes?page=1&limit=20'));
}

beforeEach(() => {
  jest.clearAllMocks();
  (requireAuth as jest.Mock).mockResolvedValue({ id: READER });
  // Asked with `include`, as the route used to, the database joins every entry's recipe,
  // whoever wrote it.
  (prisma.cookedRecipe.findMany as jest.Mock).mockImplementation(
    async (args: { include?: unknown }) =>
      ENTRIES.map((e) =>
        args.include ? { ...e, post: RECIPES.find((r) => r.id === e.postId) } : e
      )
  );
  (prisma.cookedRecipe.count as jest.Mock).mockResolvedValue(ENTRIES.length);
  // The database applies the visibility filter: bea is private and is not the reader.
  (prisma.post.findMany as jest.Mock).mockResolvedValue([publicRecipe]);
});

describe('GET /api/cooked-recipes', () => {
  it('keeps an entry whose recipe the reader may no longer see, without the recipe', async () => {
    const response = await getHistory();
    const body = await response.json();

    expect(response.status).toBe(200);
    // Every entry and the count stay: the history is the reader's own.
    expect(body.total).toBe(2);
    expect(body.cookedRecipes.map((e: { id: string }) => e.id)).toEqual(['cook-2', 'cook-1']);

    // The cooking log shows post: null as "this recipe is no longer here", unclickable.
    expect(body.cookedRecipes[0]).toMatchObject({ id: 'cook-2', postId: privateRecipe.id });
    expect(body.cookedRecipes[0].post).toBeNull();
    const sent = JSON.stringify(body);
    expect(sent).not.toContain(privateRecipe.title);
    expect(sent).not.toContain(privateRecipe.imageUrl);
    expect(sent).not.toContain('"bea"');

    // The recipes the reader may still see arrive as before.
    expect(body.cookedRecipes[1].post).toEqual(publicRecipe);
  });

  it('reads only the recipes the reader may see, and nothing of the others', async () => {
    await getHistory();

    // The entries are read without their recipes, so a hidden one is never loaded at all.
    expect((prisma.cookedRecipe.findMany as jest.Mock).mock.calls[0][0]).not.toHaveProperty(
      'include'
    );
    expect(prisma.post.findMany).toHaveBeenCalledTimes(1);
    expect((prisma.post.findMany as jest.Mock).mock.calls[0][0].where).toEqual({
      id: { in: [privateRecipe.id, publicRecipe.id] },
      AND: [visiblePostsWhere(READER)],
    });
  });
});
