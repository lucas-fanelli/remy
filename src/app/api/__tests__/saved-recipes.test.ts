/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

jest.mock('@/lib/database/prisma', () => ({
  __esModule: true,
  default: { savedRecipe: { findMany: jest.fn(), count: jest.fn() } },
}));

jest.mock('@/lib/api/auth', () => ({ verifySessionToken: jest.fn() }));

jest.mock('@/lib/container/container', () => ({
  container: { getUserService: jest.fn() },
}));

import { verifySessionToken } from '@/lib/api/auth';
import { container } from '@/lib/container/container';
import prisma from '@/lib/database/prisma';
import { visiblePostsWhere } from '@/lib/privacy/visibility';
import { GET } from '../users/[username]/saved/route';

/**
 * GET /api/users/[username]/saved — the owner's own saved recipes.
 *
 * A save outlives access to the recipe: when its author goes private, the row stays, and
 * the recipe must drop out of the list until access comes back. The route used to list
 * every save, with the recipe's title, picture and author.
 */

const OWNER = { id: 'owner-1', username: 'cocinera' };

function getSaved(): Promise<Response> {
  return GET(
    new NextRequest(`http://localhost:3000/api/users/${OWNER.username}/saved`, {
      headers: { cookie: 'auth_token=session' },
    }),
    { params: Promise.resolve({ username: OWNER.username }) }
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  (verifySessionToken as jest.Mock).mockResolvedValue({ userId: OWNER.id });
  (container.getUserService as jest.Mock).mockReturnValue({
    getUserByUsername: jest.fn().mockResolvedValue(OWNER),
  });
  (prisma.savedRecipe.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.savedRecipe.count as jest.Mock).mockResolvedValue(0);
});

describe('GET /api/users/[username]/saved', () => {
  it('lists and counts only the saves whose recipe the owner may still see', async () => {
    const response = await getSaved();

    expect(response.status).toBe(200);
    // The count reads the same filter as the list: a total that also counted the hidden
    // saves would promise rows the list never sends.
    const stillVisible = { userId: OWNER.id, post: { AND: [visiblePostsWhere(OWNER.id)] } };
    expect(prisma.savedRecipe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: stillVisible })
    );
    expect(prisma.savedRecipe.count).toHaveBeenCalledWith({ where: stillVisible });
  });
});
