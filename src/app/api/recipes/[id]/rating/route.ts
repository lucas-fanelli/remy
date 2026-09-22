import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { UUID_REGEX } from '@/lib/constants';
import prisma from '@/lib/database/prisma';
import { canSeePost, deniedPostResponse } from '@/lib/privacy/visibility';
import {
  isValidRating,
  loadRatingBreakdown,
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

    const outcome = await prisma.$transaction(async (tx) => {
      // First, and in the transaction that writes: a recipe the reader may not see is not
      // scored, and its average, count and breakdown are not handed back.
      const access = await canSeePost(tx, postId, user.id);
      if (access.status !== 'ok') return { denied: access };

      await lockRecipeForRating(tx, postId);
      await tx.rating.upsert({
        where: { userId_postId: { userId: user.id, postId } },
        create: { userId: user.id, postId, rating },
        update: { rating },
      });

      const recalculated = await recalculateRecipeRating(tx, postId);
      // The spread, not just the mean. Without it the page could only patch the average
      // and the breakdown table sat on the previous numbers until a reload.
      const breakdown = await loadRatingBreakdown(tx, postId);
      return { denied: null, summary: { ...recalculated, breakdown } };
    });

    if (outcome.denied) return deniedPostResponse(outcome.denied);

    return NextResponse.json({ myRating: rating, ...outcome.summary });
  } catch (error) {
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

    const outcome = await prisma.$transaction(async (tx) => {
      // This handler checked nothing at all: anyone could take a score back from any
      // recipe and be sent its average and breakdown, and a recipe id that did not exist
      // got as far as updating a post that was not there. Now it asks what PUT asks.
      const access = await canSeePost(tx, postId, user.id);
      if (access.status !== 'ok') return { denied: access };

      await lockRecipeForRating(tx, postId);
      // deleteMany, not delete: removing a score you do not have is the state you asked
      // for, not an error.
      await tx.rating.deleteMany({ where: { userId: user.id, postId } });
      const recalculated = await recalculateRecipeRating(tx, postId);
      const breakdown = await loadRatingBreakdown(tx, postId);
      return { denied: null, summary: { ...recalculated, breakdown } };
    });

    if (outcome.denied) return deniedPostResponse(outcome.denied);

    return NextResponse.json({ myRating: null, ...outcome.summary });
  } catch (error) {
    logServerError('Error removing rating:', error);
    return NextResponse.json(
      { error: 'Failed to remove rating', code: 'rating.removeFailed' },
      { status: 500 }
    );
  }
}
