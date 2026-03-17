import { NextRequest, NextResponse } from 'next/server';
import { MAX_COMMENT_LENGTH, UUID_REGEX } from '@/lib/constants';
import { container } from '@/lib/container/container';
import prisma from '@/lib/database/prisma';
import { extractBearerToken } from '@/lib/utils/auth';

// GET comments for a recipe
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: recipeId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50') || 50));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0') || 0);

    // Get comments with user info (paginated)
    const comments = await prisma.comment.findMany({
      where: { postId: recipeId },
      take: limit,
      skip: offset,
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
        userId: { in: comments.map((c) => c.userId) },
      },
    });

    // Create a map of userId to rating
    const ratingsMap = new Map(ratings.map((r) => [r.userId, r.rating]));

    // Attach ratings to comments
    const commentsWithRatings = comments.map((comment) => ({
      ...comment,
      rating: ratingsMap.get(comment.userId) || null,
    }));

    return NextResponse.json({ comments: commentsWithRatings });
  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
  }
}

// POST a new comment
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: recipeId } = await params;

    if (!UUID_REGEX.test(recipeId)) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }

    const token = extractBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tokenService = container.getTokenService();
    const payload = tokenService.verify(token);

    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const { text, rating, imageUrl } = body;

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: 'Comment text is required' }, { status: 400 });
    }

    if (text.length > MAX_COMMENT_LENGTH) {
      return NextResponse.json(
        { error: 'Comment text must be 5000 characters or less' },
        { status: 400 }
      );
    }

    // Validate rating if provided
    if (rating !== undefined && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
      return NextResponse.json(
        { error: 'Rating must be an integer between 1 and 5' },
        { status: 400 }
      );
    }

    // Validate imageUrl - only allow Cloudinary URLs (uploaded via our upload endpoint)
    if (imageUrl) {
      try {
        const url = new URL(imageUrl);
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
        if (!cloudName) {
          return NextResponse.json({ error: 'Image upload not configured' }, { status: 500 });
        }
        if (
          !['http:', 'https:'].includes(url.protocol) ||
          url.hostname !== 'res.cloudinary.com' ||
          !url.pathname.startsWith(`/${cloudName}/`)
        ) {
          return NextResponse.json(
            { error: 'Image must be uploaded through the app' },
            { status: 400 }
          );
        }
      } catch {
        return NextResponse.json({ error: 'Invalid image URL' }, { status: 400 });
      }
    }

    // Check if recipe exists
    const recipe = await prisma.post.findUnique({
      where: { id: recipeId },
    });

    if (!recipe) {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
    }

    // Create comment + optional rating atomically in a transaction
    const comment = await prisma.$transaction(async (tx) => {
      const newComment = await tx.comment.create({
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

      if (rating !== undefined) {
        await tx.rating.upsert({
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

        const ratingAggregation = await tx.rating.aggregate({
          where: { postId: recipeId },
          _avg: { rating: true },
          _count: { rating: true },
        });

        await tx.post.update({
          where: { id: recipeId },
          data: {
            averageRating: Math.round((ratingAggregation._avg.rating || 0) * 10) / 10,
            reviewCount: ratingAggregation._count.rating || 0,
          },
        });
      }

      return newComment;
    });

    // Create notification - non-critical, don't fail the request if this errors
    try {
      const notificationService = container.getNotificationService();
      await notificationService.createCommentNotification(
        payload.userId,
        recipeId,
        recipe.userId,
        comment.id
      );
    } catch (notifError) {
      console.warn('Failed to create comment notification:', notifError);
    }

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
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
  }
}
