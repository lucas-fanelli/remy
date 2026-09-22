import { NextRequest, NextResponse } from 'next/server';
import striptags from 'striptags';
import { requireAuth } from '@/lib/api/auth';
import { MAX_COMMENT_LENGTH, UUID_REGEX } from '@/lib/constants';
import prisma from '@/lib/database/prisma';
import { canSeePost, deniedPostResponse } from '@/lib/privacy/visibility';
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
    const { text, imageUrl } = body;

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

    // Ownership check + update atomically in a transaction to prevent TOCTOU race
    const outcome = await prisma.$transaction(async (tx) => {
      // Your own comment, but on someone else's recipe: once its author has gone private
      // and you are not let in, the thread is theirs to show or hide, and you may no more
      // edit what you wrote there than like or rate the recipe. The comment is hidden with
      // the recipe and comes back with it.
      const access = await canSeePost(tx, recipeId, user.id);
      if (access.status !== 'ok') return { denied: access };

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

      // Your score still travels beside the comment in the response, so the list can
      // show it — but this endpoint no longer writes it. That moved to
      // PUT /api/recipes/[id]/rating, where changing your mind does not mean editing
      // something you wrote.
      const ratingRecord = await tx.rating.findUnique({
        where: {
          userId_postId: {
            userId: user.id,
            postId: recipeId,
          },
        },
      });

      return { denied: null, comment: { ...updatedComment, rating: ratingRecord?.rating || null } };
    });

    if (outcome.denied) return deniedPostResponse(outcome.denied);

    return NextResponse.json({
      comment: outcome.comment,
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

    // NOT gated by canSeePost, unlike PATCH, on purpose. What you wrote is yours to take
    // back even after its recipe's author went private and shut you out: the answer is
    // "deleted" and nothing else, so it reveals nothing of the recipe. Editing stays gated —
    // rewriting a comment is writing into a conversation you can no longer see.
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

      // Deleting what you wrote does not take your score away. It used to, unless you
      // also had a cooked entry for the recipe — an exception someone had to carve out by
      // hand, and which did not filter soft-deleted cooked entries, so a cook you had
      // already undone still saved a rating. Your score is yours until you remove it at
      // DELETE /api/recipes/[id]/rating.
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
