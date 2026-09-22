import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/api/auth';
import { engagementCounts } from '@/lib/api/engagementCounts';
import { USERNAME_REGEX } from '@/lib/constants';
import { container } from '@/lib/container/container';
import prisma from '@/lib/database/prisma';
import { visiblePostsWhere } from '@/lib/privacy/visibility';
import { extractAuthToken } from '@/lib/utils/auth';
import { logServerError } from '@/lib/utils/logger';
import { safeRating } from '@/lib/utils/recipe';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;

    if (!USERNAME_REGEX.test(username)) {
      return NextResponse.json(
        { error: 'Invalid username format', code: 'request.invalidUsername' },
        { status: 400 }
      );
    }

    const token = extractAuthToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized', code: 'unauthorized' }, { status: 401 });
    }

    const payload = await verifySessionToken(token);

    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid token', code: 'auth.invalidToken' },
        { status: 401 }
      );
    }

    const userService = container.getUserService();
    const user = await userService.getUserByUsername(username);

    if (!user) {
      return NextResponse.json({ error: 'User not found', code: 'user.notFound' }, { status: 404 });
    }

    // Check if requesting user is the profile owner
    if (user.id !== payload.userId) {
      return NextResponse.json({ error: 'Forbidden', code: 'forbidden' }, { status: 403 });
    }

    // Pagination params
    const { searchParams } = new URL(request.url);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50') || 50));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0') || 0);

    // Only the saves whose recipe the owner may still see. A save outlives access: when the
    // author of a saved recipe goes private, the row stays, hidden from here, and the recipe
    // comes back if access does. The count reads the same filter, or the total would promise
    // rows the list never sends.
    const where: Prisma.SavedRecipeWhereInput = {
      userId: user.id,
      post: { AND: [visiblePostsWhere(user.id)] },
    };

    // Get saved recipes + total in parallel
    const [savedRecipes, total] = await Promise.all([
      prisma.savedRecipe.findMany({
        where,
        include: {
          post: {
            select: {
              id: true,
              title: true,
              description: true,
              imageUrl: true,
              difficulty: true,
              cookingTime: true,
              prepTime: true,
              servings: true,
              averageRating: true,
              reviewCount: true,
              createdAt: true,
              user: { select: { id: true, username: true, fullName: true, avatar: true } },
              _count: { select: { likes: true, comments: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.savedRecipe.count({ where }),
    ]);

    // Format recipes
    const formattedRecipes = savedRecipes.map(({ post }) => ({
      id: post.id,
      title: post.title || 'Untitled Recipe',
      description: post.description,
      imageUrl: post.imageUrl,
      difficulty: post.difficulty || 'medium',
      cookingTime: post.cookingTime,
      prepTime: post.prepTime,
      servings: post.servings,
      ...engagementCounts(post._count),
      averageRating: safeRating(post.averageRating),
      totalRatings: post.reviewCount ?? 0,
      createdAt: post.createdAt,
    }));

    return NextResponse.json({ recipes: formattedRecipes, total });
  } catch (error) {
    logServerError('Error fetching saved recipes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch saved recipes', code: 'recipe.savedFetchFailed' },
      { status: 500 }
    );
  }
}
