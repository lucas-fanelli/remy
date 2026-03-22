import { NextRequest, NextResponse } from 'next/server';
import { USERNAME_REGEX } from '@/lib/constants';
import { container } from '@/lib/container/container';
import prisma from '@/lib/database/prisma';
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
      return NextResponse.json({ error: 'Invalid username format' }, { status: 400 });
    }

    const token = extractAuthToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tokenService = container.getTokenService();
    const payload = tokenService.verify(token);

    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userService = container.getUserService();
    const user = await userService.getUserByUsername(username);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if requesting user is the profile owner
    if (user.id !== payload.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Pagination params
    const { searchParams } = new URL(request.url);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50') || 50));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0') || 0);

    // Get saved recipes + total in parallel
    const [savedRecipes, total] = await Promise.all([
      prisma.savedRecipe.findMany({
        where: { userId: user.id },
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
      prisma.savedRecipe.count({ where: { userId: user.id } }),
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
      likesCount: post._count.likes,
      commentsCount: post._count.comments,
      averageRating: safeRating(post.averageRating),
      totalRatings: post.reviewCount ?? 0,
      createdAt: post.createdAt,
    }));

    return NextResponse.json({ recipes: formattedRecipes, total });
  } catch (error) {
    logServerError('Error fetching saved recipes:', error);
    return NextResponse.json({ error: 'Failed to fetch saved recipes' }, { status: 500 });
  }
}
