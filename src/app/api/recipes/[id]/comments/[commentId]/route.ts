import { NextRequest, NextResponse } from 'next/server';
import striptags from 'striptags';
import { requireAuth } from '@/lib/api/auth';
import { MAX_COMMENT_LENGTH, UUID_REGEX } from '@/lib/constants';
import prisma from '@/lib/database/prisma';
import { validateCloudinaryUrl } from '@/lib/utils/cloudinary-validation';
import { logServerError } from '@/lib/utils/logger';
import { requireJsonContentType } from '@/lib/utils/request';

// PATCH - Update a comment
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const ctError = requireJsonContentType(request);
    if (ctError) return ctError;

    const { id: recipeId, commentId } = await params;

    if (!UUID_REGEX.test(recipeId) || !UUID_REGEX.test(commentId)) {
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
    const { text, rating, imageUrl } = body;

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Comment text is required', code: 'comment.textRequired' },
        { status: 400 }
      );
    }

    if (text.length > MAX_COMMENT_LENGTH) {
      return NextResponse.json(
        { error: 'Comment text must be 5000 characters or less', code: 'comment.textTooLong' },
        { status: 400 }
      );
    }

    // Validate imageUrl - only allow Cloudinary URLs (uploaded via our upload endpoint)
    if (imageUrl) {
      const cloudinaryError = validateCloudinaryUrl(imageUrl);
      if (cloudinaryError) return cloudinaryError;
    }

    // Validate rating before any writes
    if (rating !== undefined && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
      return NextResponse.json(
        { error: 'Rating must be an integer between 1 and 5', code: 'comment.invalidRating' },
        { status: 400 }
      );
    }

    // Ownership check + update atomically in a transaction to prevent TOCTOU race
    const comment = await prisma.$transaction(async (tx) => {
      const existingComment = await tx.comment.findUnique({
        where: { id: commentId },
      });

      if (!existingComment) {
        throw new Error('COMMENT_NOT_FOUND');
      }

      if (existingComment.postId !== recipeId) {
        throw new Error('COMMENT_WRONG_RECIPE');
      }

      if (existingComment.userId !== user.id) {
        throw new Error('COMMENT_UNAUTHORIZED');
      }

      const updatedComment = await tx.comment.update({
        where: { id: commentId },
        data: {
          text: striptags(text.trim()),
          ...(imageUrl !== undefined && { imageUrl: imageUrl || null }),
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
        // Lock the post row to prevent concurrent rating aggregation races
        await tx.$executeRaw`SELECT id FROM "posts" WHERE id = ${recipeId} FOR UPDATE`;

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

        // Recalculate and cache the recipe's average rating
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

      // Fetch rating inside transaction for consistency
      const ratingRecord = await tx.rating.findUnique({
        where: {
          userId_postId: {
            userId: user.id,
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
    if (error instanceof Error) {
      if (error.message === 'COMMENT_NOT_FOUND') {
        return NextResponse.json(
          { error: 'Comment not found', code: 'comment.notFound' },
          { status: 404 }
        );
      }
      if (error.message === 'COMMENT_WRONG_RECIPE') {
        return NextResponse.json(
          { error: 'Comment does not belong to this recipe', code: 'comment.wrongRecipe' },
          { status: 400 }
        );
      }
      if (error.message === 'COMMENT_UNAUTHORIZED') {
        return NextResponse.json(
          { error: 'Unauthorized to edit this comment', code: 'comment.editForbidden' },
          { status: 403 }
        );
      }
    }
    logServerError('Error updating comment:', error);
    return NextResponse.json(
      { error: 'Failed to update comment', code: 'comment.updateFailed' },
      { status: 500 }
    );
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

    await prisma.$transaction(async (tx) => {
      // 1. Find the comment (verify ownership and get postId/userId)
      const comment = await tx.comment.findUnique({
        where: { id: commentId },
      });

      if (!comment || comment.postId !== recipeId || comment.userId !== user.id) {
        throw new Error('COMMENT_NOT_FOUND_OR_UNAUTHORIZED');
      }

      // 2. Delete the comment
      await tx.comment.delete({
        where: { id: commentId },
      });

      // 3. Only delete the associated rating if the user has no cooked-recipe for this post.
      // Symmetric with cooked-recipe DELETE, which preserves ratings when a comment exists.
      const cookedRecipe = await tx.cookedRecipe.findFirst({
        where: { userId: user.id, postId: recipeId },
      });

      if (!cookedRecipe) {
        // Lock the post row to prevent concurrent rating aggregation races
        await tx.$executeRaw`SELECT id FROM "posts" WHERE id = ${recipeId} FOR UPDATE`;

        await tx.rating.deleteMany({
          where: {
            userId: user.id,
            postId: recipeId,
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
            averageRating:
              ratingAggregation._avg.rating != null
                ? Math.round(ratingAggregation._avg.rating * 10) / 10
                : undefined,
            reviewCount: ratingAggregation._count.rating ?? 0,
          },
        });
      }
    });

    return NextResponse.json({
      message: 'Comment deleted successfully',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'COMMENT_NOT_FOUND_OR_UNAUTHORIZED') {
      return NextResponse.json(
        { error: 'Comment not found or unauthorized', code: 'comment.notFoundOrForbidden' },
        { status: 404 }
      );
    }
    logServerError('Error deleting comment:', error);
    return NextResponse.json(
      { error: 'Failed to delete comment', code: 'comment.deleteFailed' },
      { status: 500 }
    );
  }
}
