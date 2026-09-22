/**
 * @jest-environment node
 *
 * A score and a comment are separate things. They were not: the only way to give a score
 * was to write a comment, and deleting that comment took the score with it — unless you
 * also had a cooked entry for the recipe, an exception someone had to carve out by hand.
 * These guard the separation, which is the kind of thing that gets quietly re-coupled.
 */
import { NextRequest } from 'next/server';

jest.mock('@/lib/database/prisma', () => ({
  __esModule: true,
  default: {
    post: { findUnique: jest.fn(), update: jest.fn() },
    comment: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    },
    cookedRecipe: { findFirst: jest.fn() },
    rating: {
      deleteMany: jest.fn(),
      upsert: jest.fn(),
      aggregate: jest.fn(),
      findUnique: jest.fn(),
    },
    $executeRaw: jest.fn(),
    $transaction: jest.fn(),
  },
}));

jest.mock('@/lib/api/auth', () => ({ requireAuth: jest.fn(), getCurrentUser: jest.fn() }));
jest.mock('@/lib/container/container', () => ({
  container: { getNotificationService: jest.fn(() => ({ createCommentNotification: jest.fn() })) },
}));

import { requireAuth } from '@/lib/api/auth';
import prisma from '@/lib/database/prisma';
import { DELETE as commentDELETE } from '../recipes/[id]/comments/[commentId]/route';
import { POST as commentPOST } from '../recipes/[id]/comments/route';

const RECIPE = '7e783849-1e07-4ac7-9b95-fe3a40fe622e';
const COMMENT = '0da1dbf8-1363-42fa-b78f-7ca1572150e0';

beforeEach(() => {
  jest.clearAllMocks();
  (requireAuth as jest.Mock).mockResolvedValue({ id: 'user-1' });
  (prisma.$transaction as jest.Mock).mockImplementation((fn) => fn(prisma));
  // What canSeePost reads: the author, public here. recipe-access.test.ts covers private.
  (prisma.post.findUnique as jest.Mock).mockResolvedValue({
    userId: 'author-1',
    user: { isPrivate: false, username: 'author' },
  });
  (prisma.comment.findFirst as jest.Mock).mockResolvedValue({ id: COMMENT, userId: 'user-1' });
  (prisma.comment.findUnique as jest.Mock).mockResolvedValue({
    id: COMMENT,
    userId: 'user-1',
    postId: RECIPE,
  });
  (prisma.comment.create as jest.Mock).mockResolvedValue({ id: 'c1', text: 'hi', user: {} });
  (prisma.cookedRecipe.findFirst as jest.Mock).mockResolvedValue(null);
});

describe('deleting a comment', () => {
  it('leaves the reader’s rating alone', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/recipes/${RECIPE}/comments/${COMMENT}`,
      { method: 'DELETE', headers: { 'X-Requested-With': 'fetch' } }
    );

    const response = await commentDELETE(request, {
      params: Promise.resolve({ id: RECIPE, commentId: COMMENT }),
    });

    expect(response.status).toBe(200);
    expect(prisma.comment.delete).toHaveBeenCalled();
    // This used to run, and take the score with the words.
    expect(prisma.rating.deleteMany).not.toHaveBeenCalled();
  });

  it('does not consult cooked entries to decide the rating’s fate', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/recipes/${RECIPE}/comments/${COMMENT}`,
      { method: 'DELETE', headers: { 'X-Requested-With': 'fetch' } }
    );

    await commentDELETE(request, {
      params: Promise.resolve({ id: RECIPE, commentId: COMMENT }),
    });

    // The old exception spared the rating only when a cooked entry existed — and did not
    // filter soft-deleted ones, so a cook you had already undone still saved it.
    expect(prisma.cookedRecipe.findFirst).not.toHaveBeenCalled();
  });
});

describe('posting a comment', () => {
  it('ignores a rating sent alongside the text', async () => {
    const request = new NextRequest(`http://localhost:3000/api/recipes/${RECIPE}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
      body: JSON.stringify({ text: 'Lovely', rating: 5 }),
    });

    await commentPOST(request, { params: Promise.resolve({ id: RECIPE }) });

    // An old client, or a hand-rolled request, must not be able to score this way.
    expect(prisma.rating.upsert).not.toHaveBeenCalled();
  });
});
