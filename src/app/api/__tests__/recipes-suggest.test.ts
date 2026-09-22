/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

jest.mock('@/lib/api/auth', () => ({ requireAuth: jest.fn() }));

jest.mock('@/lib/container/container', () => ({
  container: { getIngredientMatchService: jest.fn(), getPantryService: jest.fn() },
}));

import { RecipeRepository } from '@/infrastructure/repositories/RecipeRepository';
import { IngredientMatchService } from '@/infrastructure/services/IngredientMatchService';
import { requireAuth } from '@/lib/api/auth';
import { container } from '@/lib/container/container';
import { visiblePostsWhere } from '@/lib/privacy/visibility';
import { POST } from '../recipes/suggest/route';
import type { PrismaClient } from '@prisma/client';

/**
 * POST /api/recipes/suggest — recipes to cook from a list of ingredients.
 *
 * The route, the matching service and the repository run for real here; only the database
 * is replaced. The query behind the suggestions used to carry no privacy filter at all, so
 * anyone signed in was suggested private accounts' recipes, ingredients and all.
 */

const VIEWER = 'viewer-1';

const findMany = jest.fn();

function suggest(body: unknown): Promise<Response> {
  return POST(
    new NextRequest('http://localhost:3000/api/recipes/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
      body: JSON.stringify(body),
    })
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  (requireAuth as jest.Mock).mockResolvedValue({ id: VIEWER });
  findMany.mockResolvedValue([]);
  const recipes = new RecipeRepository({ post: { findMany } } as unknown as PrismaClient);
  (container.getIngredientMatchService as jest.Mock).mockReturnValue(
    new IngredientMatchService(recipes)
  );
});

describe('POST /api/recipes/suggest', () => {
  it("scores only the recipes the viewer may see: public authors' and their own", async () => {
    const response = await suggest({ ingredients: ['tomate', 'cebolla'] });

    expect(response.status).toBe(200);
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany.mock.calls[0][0].where).toEqual({ AND: [visiblePostsWhere(VIEWER)] });
  });

  it('keeps the difficulty filter beside the privacy one', async () => {
    await suggest({ ingredients: ['tomate'], filters: { difficulty: 'easy' } });

    expect(findMany.mock.calls[0][0].where).toEqual({
      AND: [visiblePostsWhere(VIEWER)],
      difficulty: 'easy',
    });
  });
});
