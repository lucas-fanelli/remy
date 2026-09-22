import { NextRequest, NextResponse } from 'next/server';
import striptags from 'striptags';
import { getCurrentUser, requireAuth } from '@/lib/api/auth';
import { MAX_COMMENT_LENGTH, UUID_REGEX } from '@/lib/constants';
import { container } from '@/lib/container/container';
import prisma from '@/lib/database/prisma';
import { canSeePost, deniedPostResponse } from '@/lib/privacy/visibility';
import { validateCloudinaryUrl } from '@/lib/utils/cloudinary-validation';
import { logServerError } from '@/lib/utils/logger';
import { requireJsonContentType } from '@/lib/utils/request';

// GET comments for a recipe
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: recipeId } = await params;

    if (!UUID_REGEX.test(recipeId)) {
      return NextResponse.json(
        { error: 'Invalid ID format', code: 'request.invalidId' },
        { status: 400 }
      );
    }

    // Sign-in stays optional: anyone may read the comments on a public recipe, as they may
    // read the recipe itself. A private author's thread is for whoever may read that
    // author's recipes. This handler used to check nothing, not even that the recipe
    // existed, so anyone holding the id of a private recipe could read its thread and
    // every score in it.
    const viewer = await getCurrentUser(request);
    const access = await canSeePost(prisma, recipeId, viewer?.id ?? null);
    if (access.status !== 'ok') return deniedPostResponse(access);

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

    // Each commenter's score for this recipe, shown beside what they wrote. It is read
    // from Rating, never stored on the comment — one person has one score per recipe
    // however many times they comment.
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
    return NextResponse.json(
      { error: 'Failed to fetch comments', code: 'comment.fetchFailed' },
      { status: 500 }
    );
  }
}

// POST a new comment
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctError = requireJsonContentType(request);
    if (ctError) return ctError;

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
    // KNOWN LIMITATION: Any valid Cloudinary URL is accepted. Upload ownership tracking
    // is not implemented (see upload/route.ts).
    if (imageUrl) {
      const cloudinaryError = validateCloudinaryUrl(imageUrl);
      if (cloudinaryError) return cloudinaryError;
    }

    // The access check and the comment in one transaction: nothing is written, and the
    // author is not notified, on a recipe the commenter may not see.
    const outcome = await prisma.$transaction(async (tx) => {
      const access = await canSeePost(tx, recipeId, user.id);
      if (access.status !== 'ok') return { denied: access };

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

      return { denied: null, comment: newComment, recipeAuthorId: access.authorId };
    });

    if (outcome.denied) return deniedPostResponse(outcome.denied);
    const { comment, recipeAuthorId } = outcome;

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

    // No rating here: the score is its own thing now, at PUT /api/recipes/[id]/rating.
    // A reader who has rated the recipe still has their score shown beside this comment
    // when the list is fetched — it is read from their Rating, not carried by the comment.
    return NextResponse.json({
      comment,
      message: 'Comment added successfully',
    });
  } catch (error) {
    logServerError('Error creating comment:', error);
    return NextResponse.json(
      { error: 'Failed to create comment', code: 'comment.createFailed' },
      { status: 500 }
    );
  }
}
