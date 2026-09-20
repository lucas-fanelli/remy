/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

jest.mock('@/lib/database/prisma', () => ({
  __esModule: true,
  default: {
    post: { findUnique: jest.fn(), update: jest.fn() },
    rating: { upsert: jest.fn(), deleteMany: jest.fn(), aggregate: jest.fn() },
    $executeRaw: jest.fn(),
    $transaction: jest.fn(),
  },
}));

jest.mock('@/lib/api/auth', () => ({ requireAuth: jest.fn() }));

import { requireAuth } from '@/lib/api/auth';
import prisma from '@/lib/database/prisma';
import { DELETE as ratingDELETE, PUT as ratingPUT } from '../recipes/[id]/rating/route';

const VALID_UUID = '7e783849-1e07-4ac7-9b95-fe3a40fe622e';
const params = Promise.resolve({ id: VALID_UUID });

function put(body: unknown, contentType = 'application/json'): NextRequest {
  return new NextRequest(`http://localhost:3000/api/recipes/${VALID_UUID}/rating`, {
    method: 'PUT',
    headers: { 'Content-Type': contentType, 'X-Requested-With': 'fetch' },
    body: JSON.stringify(body),
  });
}

function del(): NextRequest {
  return new NextRequest(`http://localhost:3000/api/recipes/${VALID_UUID}/rating`, {
    method: 'DELETE',
    headers: { 'X-Requested-With': 'fetch' },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  (requireAuth as jest.Mock).mockResolvedValue({ id: 'user-1' });
  (prisma.post.findUnique as jest.Mock).mockResolvedValue({ id: VALID_UUID });
  (prisma.rating.aggregate as jest.Mock).mockResolvedValue({
    _avg: { rating: 4.5 },
    _count: { rating: 2 },
  });
  (prisma.$transaction as jest.Mock).mockImplementation((fn) => fn(prisma));
});

describe('PUT /api/recipes/[id]/rating', () => {
  it('saves a score without needing a comment', async () => {
    // The whole point: there was no way to do this. A score could only be written as a
    // side effect of POST /comments, so rating meant saying something.
    const response = await ratingPUT(put({ rating: 5 }), { params });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(prisma.rating.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_postId: { userId: 'user-1', postId: VALID_UUID } },
        create: { userId: 'user-1', postId: VALID_UUID, rating: 5 },
        update: { rating: 5 },
      })
    );
    expect(body.myRating).toBe(5);
  });

  it('returns the recipe average alongside your score', async () => {
    const response = await ratingPUT(put({ rating: 5 }), { params });
    const body = await response.json();

    // So the star you just pressed and the average beside it cannot disagree on screen.
    expect(body).toMatchObject({ myRating: 5, averageRating: 4.5, reviewCount: 2 });
  });

  it('is idempotent — the same score twice leaves the same result', async () => {
    const first = await (await ratingPUT(put({ rating: 4 }), { params })).json();
    const second = await (await ratingPUT(put({ rating: 4 }), { params })).json();

    expect(second).toEqual(first);
  });

  it.each([0, 6, 2.5, -1, '4', null])('refuses %p as a score', async (rating) => {
    const response = await ratingPUT(put({ rating }), { params });

    expect(response.status).toBe(400);
    expect(prisma.rating.upsert).not.toHaveBeenCalled();
  });

  it('refuses a recipe that does not exist', async () => {
    (prisma.post.findUnique as jest.Mock).mockResolvedValue(null);

    const response = await ratingPUT(put({ rating: 4 }), { params });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe('recipe.notFound');
  });

  it('refuses a signed-out reader', async () => {
    (requireAuth as jest.Mock).mockRejectedValue(new Error('no session'));

    const response = await ratingPUT(put({ rating: 4 }), { params });

    expect(response.status).toBe(401);
    expect(prisma.rating.upsert).not.toHaveBeenCalled();
  });

  it('rejects a malformed id before touching the database', async () => {
    const response = await ratingPUT(put({ rating: 4 }), {
      params: Promise.resolve({ id: 'not-a-uuid' }),
    });

    expect(response.status).toBe(400);
    expect(prisma.rating.upsert).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/recipes/[id]/rating', () => {
  it('takes your score back', async () => {
    (prisma.rating.aggregate as jest.Mock).mockResolvedValue({
      _avg: { rating: null },
      _count: { rating: 0 },
    });

    const response = await ratingDELETE(del(), { params });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(prisma.rating.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', postId: VALID_UUID },
    });
    expect(body.myRating).toBeNull();
  });

  it('writes 0 rather than leaving the old average behind', async () => {
    (prisma.rating.aggregate as jest.Mock).mockResolvedValue({
      _avg: { rating: null },
      _count: { rating: 0 },
    });

    await ratingDELETE(del(), { params });

    // The hand-written copies of this passed `undefined`, which Prisma reads as "leave
    // this column alone" — so a recipe that lost its last rating kept the average it had.
    expect(prisma.post.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { averageRating: 0, reviewCount: 0 } })
    );
  });

  it('succeeds when you had no score to begin with', async () => {
    (prisma.rating.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });

    const response = await ratingDELETE(del(), { params });

    expect(response.status).toBe(200);
  });

  it('refuses a signed-out reader', async () => {
    (requireAuth as jest.Mock).mockRejectedValue(new Error('no session'));

    const response = await ratingDELETE(del(), { params });

    expect(response.status).toBe(401);
    expect(prisma.rating.deleteMany).not.toHaveBeenCalled();
  });
});
