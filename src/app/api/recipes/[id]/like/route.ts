import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { UUID_REGEX } from '@/lib/constants';
import { container } from '@/lib/container/container';
import prisma from '@/lib/database/prisma';
import { logServerError } from '@/lib/utils/logger';

/**
 * POST /api/recipes/[id]/like — say whether YOU like this recipe.
 *
 * The request states the intended end state (`{ liked: true }`), it does not ask for a
 * flip. A flip cannot be retried: when the response was lost to a dropped connection the
 * client had no way to know whether its first attempt had landed, and sending it again
 * undid the like. Stating the intent makes the call idempotent — the same request twice
 * leaves the same result — which is what lets the UI retry, and what stopped the heart
 * from ending up opposite to what the reader asked for.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: recipeId } = await params;

    if (!UUID_REGEX.test(recipeId)) {
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

    // COMPATIBILITY SHIM — remove once no installed client predates this release.
    // A tab that was already open when this deployed is still running the old bundle,
    // which posts no body because it can only ask for a flip. Rejecting it would make the
    // heart dead until the reader reloads; `undefined` keeps the old behaviour for them.
    let intent: boolean | undefined;
    try {
      const body = await request.json();
      if (typeof body?.liked === 'boolean') intent = body.liked;
    } catch {
      // No body, or not JSON: treat as a legacy flip.
    }

    const result = await prisma.$transaction(async (tx) => {
      const recipe = await tx.post.findUnique({
        where: { id: recipeId },
        select: { userId: true },
      });
      if (!recipe) {
        throw new Error('RECIPE_NOT_FOUND');
      }

      const existingLike = await tx.like.findUnique({
        where: { postId_userId: { postId: recipeId, userId: user.id } },
        select: { id: true },
      });

      const shouldBeLiked = intent ?? !existingLike;

      // Converge on the requested state. Both branches are no-ops when already there, so
      // a repeated request changes nothing rather than undoing the previous one.
      if (shouldBeLiked && !existingLike) {
        await tx.like.create({ data: { postId: recipeId, userId: user.id } });
      } else if (!shouldBeLiked && existingLike) {
        await tx.like.delete({ where: { id: existingLike.id } });
      }

      const likeCount = await tx.like.count({ where: { postId: recipeId } });
      return {
        liked: shouldBeLiked,
        likeCount,
        recipeAuthorId: recipe.userId,
        changed: shouldBeLiked !== !!existingLike,
      };
    });

    // Handle notifications outside transaction (non-critical). Only on an actual change:
    // a repeated "like" must not send the author a second notification.
    if (result.changed) {
      try {
        const notificationService = container.getNotificationService();
        if (result.liked) {
          await notificationService.createLikeNotification(
            user.id,
            recipeId,
            result.recipeAuthorId
          );
        } else {
          await notificationService.deleteLikeNotification(
            user.id,
            recipeId,
            result.recipeAuthorId
          );
        }
      } catch {
        // Notification failure is non-critical
      }
    }

    return NextResponse.json({
      liked: result.liked,
      likeCount: result.likeCount,
      message: result.liked ? 'Recipe liked' : 'Recipe unliked',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'RECIPE_NOT_FOUND') {
      return NextResponse.json(
        { error: 'Recipe not found', code: 'recipe.notFound' },
        { status: 404 }
      );
    }
    logServerError('Error setting like:', error);
    return NextResponse.json(
      { error: 'Failed to toggle like', code: 'recipe.likeFailed' },
      { status: 500 }
    );
  }
}
