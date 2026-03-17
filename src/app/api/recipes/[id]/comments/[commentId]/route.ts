import { NextRequest, NextResponse } from 'next/server';
import { MAX_COMMENT_LENGTH, UUID_REGEX } from '@/lib/constants';
import { container } from '@/lib/container/container';
import prisma from '@/lib/database/prisma';
import { extractBearerToken } from '@/lib/utils/auth';

// PATCH - Update a comment
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const { id: recipeId, commentId } = await params;

    if (!UUID_REGEX.test(recipeId) || !UUID_REGEX.test(commentId)) {
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
    const { text, rating } = body;

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: 'Comment text is required' }, { status: 400 });
    }

    if (text.length > MAX_COMMENT_LENGTH) {
      return NextResponse.json(
        { error: 'Comment text must be 5000 characters or less' },
        { status: 400 }
      );
    }

    // Check if comment exists and user owns it
    const existingComment = await prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!existingComment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    if (existingComment.postId !== recipeId) {
      return NextResponse.json(
        { error: 'Comment does not belong to this recipe' },
        { status: 400 }
      );
    }

    if (existingComment.userId !== payload.userId) {
      return NextResponse.json({ error: 'Unauthorized to edit this comment' }, { status: 403 });
    }

    // Validate rating before any writes
    if (rating !== undefined && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
      return NextResponse.json(
        { error: 'Rating must be an integer between 1 and 5' },
        { status: 400 }
      );
    }

    // Update comment and rating atomically in a transaction
    const comment = await prisma.$transaction(async (tx) => {
      const updatedComment = await tx.comment.update({
        where: { id: commentId },
        data: {
          text: text.trim(),
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

      // If rating provided, upsert rating
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

        // Recalculate and cache the recipe's average rating
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

      // Fetch rating inside transaction for consistency
      const ratingRecord = await tx.rating.findUnique({
        where: {
          userId_postId: {
            userId: payload.userId,
            postId: recipeId,
          },
        },
      });

      return { ...updatedComment, rating: ratingRecord?.rating || null };
    });

    const commentWithRating = comment;

    return NextResponse.json({
      comment: commentWithRating,
      message: 'Comment updated successfully',
    });
  } catch (error) {
    console.error('Error updating comment:', error);
    return NextResponse.json({ error: 'Failed to update comment' }, { status: 500 });
  }
}

// DELETE - Delete a comment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const { id: recipeId, commentId } = await params;

    if (!UUID_REGEX.test(recipeId) || !UUID_REGEX.test(commentId)) {
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

    // Check if comment exists and user owns it
    const existingComment = await prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!existingComment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    if (existingComment.postId !== recipeId) {
      return NextResponse.json(
        { error: 'Comment does not belong to this recipe' },
        { status: 400 }
      );
    }

    if (existingComment.userId !== payload.userId) {
      return NextResponse.json({ error: 'Unauthorized to delete this comment' }, { status: 403 });
    }

    // Delete only the comment — ratings are separate entities and should persist
    await prisma.comment.delete({ where: { id: commentId } });

    return NextResponse.json({
      message: 'Comment deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting comment:', error);
    return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 });
  }
}
