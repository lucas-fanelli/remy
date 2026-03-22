import { NextRequest, NextResponse } from 'next/server';
import striptags from 'striptags';
import { requireAuth } from '@/lib/api/auth';
import { MAX_COMMENT_LENGTH, UUID_REGEX } from '@/lib/constants';
import { container } from '@/lib/container/container';
import prisma from '@/lib/database/prisma';
import { validateCloudinaryUrl } from '@/lib/utils/cloudinary-validation';
import { logServerError } from '@/lib/utils/logger';
import { requireJsonContentType } from '@/lib/utils/request';

// GET comments for a recipe
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: recipeId } = await params;

    if (!UUID_REGEX.test(recipeId)) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50') || 50));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0') || 0);

    // Get comments with user info (paginated) and total count in parallel
    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
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
      }),
      prisma.comment.count({ where: { postId: recipeId } }),
    ]);

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

    return NextResponse.json({ comments: commentsWithRatings, total });
  } catch (error) {
    logServerError('Error fetching comments:', error);
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
  }
}

// POST a new comment
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctError = requireJsonContentType(request);
    if (ctError) return ctError;

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
    // KNOWN LIMITATION: Any valid Cloudinary URL is accepted. Upload ownership tracking
    // is not implemented (see upload/route.ts).
    if (imageUrl) {
      const cloudinaryError = validateCloudinaryUrl(imageUrl);
      if (cloudinaryError) return cloudinaryError;
    }

    // Recipe check + comment creation atomically in a single transaction
    const { comment, recipeAuthorId } = await prisma.$transaction(async (tx) => {
      const recipe = await tx.post.findUnique({ where: { id: recipeId } });
      if (!recipe) {
        throw new Error('RECIPE_NOT_FOUND');
      }

      // Lock the Post row to prevent concurrent rating aggregation races
      await tx.$executeRaw`SELECT id FROM "Post" WHERE id = ${recipeId} FOR UPDATE`;

      const newComment = await tx.comment.create({
        data: {
          text: striptags(text.trim()),
          imageUrl: imageUrl || null,
          postId: recipeId,
          userId: user.id,
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
              userId: user.id,
              postId: recipeId,
            },
          },
          create: {
            userId: user.id,
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
            // Use null when no ratings exist so unrated recipes are distinguishable from 0-rated
            averageRating:
              ratingAggregation._avg.rating != null
                ? Math.round(ratingAggregation._avg.rating * 10) / 10
                : undefined,
            reviewCount: ratingAggregation._count.rating ?? 0,
          },
        });
      }

      return { comment: newComment, recipeAuthorId: recipe.userId };
    });

    // Create notification - non-critical, don't fail the request if this errors
    try {
      const notificationService = container.getNotificationService();
      await notificationService.createCommentNotification(
        user.id,
        recipeId,
        recipeAuthorId,
        comment.id
      );
    } catch (notifError) {
      logServerError('Failed to create comment notification:', notifError);
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
    if (error instanceof Error && error.message === 'RECIPE_NOT_FOUND') {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
    }
    logServerError('Error creating comment:', error);
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
  }
}
