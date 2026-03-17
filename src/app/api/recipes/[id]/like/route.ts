import { NextRequest, NextResponse } from 'next/server';
import { container } from '@/lib/container/container';
import prisma from '@/lib/database/prisma';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: recipeId } = await params;

    // Get authorization token
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const tokenService = container.getTokenService();
    const payload = tokenService.verify(token);

    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Check if recipe exists
    const recipe = await prisma.post.findUnique({
      where: { id: recipeId },
    });

    if (!recipe) {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
    }

    // Atomic like toggle using try/catch on unique constraint
    const existingLike = await prisma.like.findUnique({
      where: {
        postId_userId: {
          postId: recipeId,
          userId: payload.userId,
        },
      },
    });

    const notificationService = container.getNotificationService();

    if (existingLike) {
      // Unlike - atomic delete + count
      try {
        const [, likesCount] = await prisma.$transaction([
          prisma.like.delete({ where: { id: existingLike.id } }),
          prisma.like.count({ where: { postId: recipeId } }),
        ]);
        await notificationService.deleteLikeNotification(payload.userId, recipeId, recipe.userId);
        return NextResponse.json({ liked: false, likesCount, message: 'Recipe unliked' });
      } catch (err: unknown) {
        if (err instanceof Error && err.message.includes('Record to delete does not exist')) {
          const likesCount = await prisma.like.count({ where: { postId: recipeId } });
          return NextResponse.json({ liked: false, likesCount, message: 'Recipe unliked' });
        }
        throw err;
      }
    } else {
      // Like - atomic create + count
      try {
        const [, likesCount] = await prisma.$transaction([
          prisma.like.create({ data: { postId: recipeId, userId: payload.userId } }),
          prisma.like.count({ where: { postId: recipeId } }),
        ]);
        await notificationService.createLikeNotification(payload.userId, recipeId, recipe.userId);
        return NextResponse.json({ liked: true, likesCount, message: 'Recipe liked' });
      } catch (err: unknown) {
        if (err instanceof Error && err.message.includes('Unique constraint')) {
          const likesCount = await prisma.like.count({ where: { postId: recipeId } });
          return NextResponse.json({ liked: true, likesCount, message: 'Recipe liked' });
        }
        throw err;
      }
    }
  } catch (error) {
    console.error('Error toggling like:', error);
    return NextResponse.json({ error: 'Failed to toggle like' }, { status: 500 });
  }
}

// GET endpoint to check if user has liked a recipe
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: recipeId } = await params;

    // Get total likes count (works for guests too)
    const likesCount = await prisma.like.count({
      where: { postId: recipeId },
    });

    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ liked: false, likesCount });
    }

    const token = authHeader.substring(7);
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
    console.error('Error checking like status:', error);
    return NextResponse.json({ liked: false, likesCount: 0 });
  }
}
