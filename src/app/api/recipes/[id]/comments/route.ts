import { NextRequest, NextResponse } from 'next/server';
import { container } from '@/lib/container/container';
import prisma from '@/lib/database/prisma';

// GET comments for a recipe
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: recipeId } = await params;

    // Get comments with user info
    const comments = await prisma.comment.findMany({
      where: { postId: recipeId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get ratings for all users who commented
    const ratings = await prisma.rating.findMany({
      where: {
        postId: recipeId,
        userId: { in: comments.map(c => c.userId) },
      },
    });

    // Create a map of userId to rating
    const ratingsMap = new Map(ratings.map(r => [r.userId, r.rating]));

    // Attach ratings to comments
    const commentsWithRatings = comments.map(comment => ({
      ...comment,
      rating: ratingsMap.get(comment.userId) || null,
    }));

    return NextResponse.json({ comments: commentsWithRatings });
  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch comments' },
      { status: 500 }
    );
  }
}

// POST a new comment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: recipeId } = await params;

    // Get authorization token
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const tokenService = container.getTokenService();
    const payload = tokenService.verify(token);

    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { text, rating, imageUrl } = body;

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Comment text is required' },
        { status: 400 }
      );
    }

    // Validate rating if provided
    if (rating !== undefined && (rating < 1 || rating > 5)) {
      return NextResponse.json(
        { error: 'Rating must be between 1 and 5' },
        { status: 400 }
      );
    }

    // Check if recipe exists
    const recipe = await prisma.post.findUnique({
      where: { id: recipeId },
    });

    if (!recipe) {
      return NextResponse.json(
        { error: 'Recipe not found' },
        { status: 404 }
      );
    }

    // Create comment
    const comment = await prisma.comment.create({
      data: {
        text: text.trim(),
        imageUrl: imageUrl || null,
        postId: recipeId,
        userId: payload.userId,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    // If rating provided, upsert rating separately
    if (rating !== undefined) {
      await prisma.rating.upsert({
        where: {
          userId_postId: {
            userId: payload.userId,
            postId: recipeId,
          },
        },
        create: {
          userId: payload.userId,
          postId: recipeId,
          rating,
        },
        update: {
          rating,
        },
      });

      // Recalculate and cache the recipe's average rating
      const ratingAggregation = await prisma.rating.aggregate({
        where: { postId: recipeId },
        _avg: { rating: true },
        _count: { rating: true },
      });

      await prisma.post.update({
        where: { id: recipeId },
        data: {
          averageRating: Math.round((ratingAggregation._avg.rating || 0) * 10) / 10,
          reviewCount: ratingAggregation._count.rating || 0,
        },
      });

      // Create rating notification
      const notificationService = container.getNotificationService();
      await notificationService.createRatingNotification(payload.userId, recipeId, recipe.userId);
    }

    // Create comment notification
    const notificationService = container.getNotificationService();
    await notificationService.createCommentNotification(payload.userId, recipeId, recipe.userId, comment.id);

    // Add rating to comment object for response
    const commentWithRating = {
      ...comment,
      rating: rating || null,
    };

    return NextResponse.json({
      comment: commentWithRating,
      message: 'Comment added successfully',
    });
  } catch (error) {
    console.error('Error creating comment:', error);
    return NextResponse.json(
      { error: 'Failed to create comment' },
      { status: 500 }
    );
  }
}
