import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { UUID_REGEX } from '@/lib/constants';
import prisma from '@/lib/database/prisma';
import {
  isValidRating,
  lockRecipeForRating,
  recalculateRecipeRating,
} from '@/lib/ratings/recipeRating';
import { logServerError } from '@/lib/utils/logger';
import { requireJsonContentType } from '@/lib/utils/request';

/**
 * Rating a recipe, on its own.
 *
 * There was no endpoint for this. The only way to score a recipe was to write a comment
 * and let `POST /comments` upsert a rating on the side — so you could not rate without
 * saying something, could not change your score without editing that comment, and lost
 * your score entirely if you ever deleted it.
 */

/** PUT — set or change your score. Idempotent: the same score twice is the same result. */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctError = requireJsonContentType(request);
    if (ctError) return ctError;

    const { id: postId } = await params;
    if (!UUID_REGEX.test(postId)) {
      return NextResponse.json(
        { error: 'Invalid ID format', code: 'request.invalidId' },
        { status: 400 }
      );
    }

    let user;
    try {
      user = await requireAuth(request);
    } catch {
      return NextResponse.json({ error: 'Unauthorized', code: 'unauthorized' }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body', code: 'invalidRequest' },
        { status: 400 }
      );
    }

    if (!isValidRating(body?.rating)) {
      return NextResponse.json(
        { error: 'Rating must be a whole number from 1 to 5', code: 'rating.invalid' },
        { status: 400 }
      );
    }
    const rating: number = body.rating;

    const summary = await prisma.$transaction(async (tx) => {
      const recipe = await tx.post.findUnique({ where: { id: postId }, select: { id: true } });
      if (!recipe) throw new Error('RECIPE_NOT_FOUND');

      await lockRecipeForRating(tx, postId);
      await tx.rating.upsert({
        where: { userId_postId: { userId: user.id, postId } },
        create: { userId: user.id, postId, rating },
        update: { rating },
      });

      return recalculateRecipeRating(tx, postId);
    });

    return NextResponse.json({ myRating: rating, ...summary });
  } catch (error) {
    if (error instanceof Error && error.message === 'RECIPE_NOT_FOUND') {
      return NextResponse.json(
        { error: 'Recipe not found', code: 'recipe.notFound' },
        { status: 404 }
      );
    }
    logServerError('Error saving rating:', error);
    return NextResponse.json(
      { error: 'Failed to save rating', code: 'rating.saveFailed' },
      { status: 500 }
    );
  }
}

/** DELETE — take your score back. Succeeds whether or not you had one. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params;
    if (!UUID_REGEX.test(postId)) {
      return NextResponse.json(
        { error: 'Invalid ID format', code: 'request.invalidId' },
        { status: 400 }
      );
    }

    let user;
    try {
      user = await requireAuth(request);
    } catch {
      return NextResponse.json({ error: 'Unauthorized', code: 'unauthorized' }, { status: 401 });
    }

    const summary = await prisma.$transaction(async (tx) => {
      await lockRecipeForRating(tx, postId);
      // deleteMany, not delete: removing a score you do not have is the state you asked
      // for, not an error.
      await tx.rating.deleteMany({ where: { userId: user.id, postId } });
      return recalculateRecipeRating(tx, postId);
    });

    return NextResponse.json({ myRating: null, ...summary });
  } catch (error) {
    logServerError('Error removing rating:', error);
    return NextResponse.json(
      { error: 'Failed to remove rating', code: 'rating.removeFailed' },
      { status: 500 }
    );
  }
}
