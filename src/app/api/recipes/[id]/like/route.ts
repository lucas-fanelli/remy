import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { UUID_REGEX } from '@/lib/constants';
import { container } from '@/lib/container/container';
import prisma from '@/lib/database/prisma';
import { extractAuthToken } from '@/lib/utils/auth'; // Used by GET for optional auth (guests see liked:false)
import { logServerError } from '@/lib/utils/logger';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: recipeId } = await params;

    if (!UUID_REGEX.test(recipeId)) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }

    let user;
    try {
      user = await requireAuth(request);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fully atomic like toggle — recipe check inside the transaction
    const result = await prisma.$transaction(async (tx) => {
      const recipe = await tx.post.findUnique({ where: { id: recipeId } });
      if (!recipe) {
        throw new Error('RECIPE_NOT_FOUND');
      }

      const existingLike = await tx.like.findUnique({
        where: { postId_userId: { postId: recipeId, userId: user.id } },
      });

      if (existingLike) {
        await tx.like.delete({ where: { id: existingLike.id } });
      } else {
        await tx.like.create({ data: { postId: recipeId, userId: user.id } });
      }

      const likesCount = await tx.like.count({ where: { postId: recipeId } });
      return { liked: !existingLike, likesCount, recipeAuthorId: recipe.userId };
    });

    // Handle notifications outside transaction (non-critical)
    try {
      const notificationService = container.getNotificationService();
      if (result.liked) {
        await notificationService.createLikeNotification(user.id, recipeId, result.recipeAuthorId);
      } else {
        await notificationService.deleteLikeNotification(user.id, recipeId, result.recipeAuthorId);
      }
    } catch {
      // Notification failure is non-critical
    }

    return NextResponse.json({
      liked: result.liked,
      likesCount: result.likesCount,
      message: result.liked ? 'Recipe liked' : 'Recipe unliked',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'RECIPE_NOT_FOUND') {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
    }
    logServerError('Error toggling like:', error);
    return NextResponse.json({ error: 'Failed to toggle like' }, { status: 500 });
  }
}

// GET endpoint to check if user has liked a recipe
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: recipeId } = await params;

    if (!UUID_REGEX.test(recipeId)) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }

    // Get total likes count (works for guests too)
    const likesCount = await prisma.like.count({
      where: { postId: recipeId },
    });

    const token = extractAuthToken(request);
    if (!token) {
      return NextResponse.json({ liked: false, likesCount });
    }

    const tokenService = container.getTokenService();
    const payload = tokenService.verify(token);

    if (!payload) {
      return NextResponse.json({ liked: false, likesCount });
    }

    // Check if liked
    const like = await prisma.like.findUnique({
      where: {
        postId_userId: {
          postId: recipeId,
          userId: payload.userId,
        },
      },
    });

    return NextResponse.json({
      liked: !!like,
      likesCount,
    });
  } catch (error) {
    logServerError('Error checking like status:', error);
    return NextResponse.json({ liked: false, likesCount: 0 });
  }
}
