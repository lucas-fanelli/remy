import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/api/auth';
import { USERNAME_REGEX } from '@/lib/constants';
import { container } from '@/lib/container/container';
import prisma from '@/lib/database/prisma';
import { extractAuthToken } from '@/lib/utils/auth';
import { logServerError } from '@/lib/utils/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;

    if (!USERNAME_REGEX.test(username)) {
      return NextResponse.json({ error: 'Invalid username format' }, { status: 400 });
    }

    // Optional auth — get current user if authenticated
    const token = extractAuthToken(request);
    let currentUserId: string | null = null;
    if (token) {
      try {
        const payload = await verifySessionToken(token);
        if (payload) currentUserId = payload.userId;
      } catch (error) {
        const isExpectedJwtError =
          error instanceof Error &&
          (error.name === 'JsonWebTokenError' ||
            error.name === 'TokenExpiredError' ||
            error.name === 'NotBeforeError');
        if (!isExpectedJwtError) {
          logServerError('Unexpected error during token verification:', error);
        }
      }
    }

    const userService = container.getUserService();

    // Get user
    const user = await userService.getUserByUsername(username);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Privacy check
    if (user.isPrivate && currentUserId !== user.id) {
      return NextResponse.json({ error: 'This profile is private' }, { status: 403 });
    }

    // Pagination params
    const { searchParams } = new URL(request.url);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50') || 50));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0') || 0);

    // Get user's recipes with counts + total in parallel
    const [recipes, total] = await Promise.all([
      prisma.post.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          _count: {
            select: {
              likes: true,
              comments: true,
            },
          },
        },
      }),
      prisma.post.count({ where: { userId: user.id } }),
    ]);

    // Format recipes
    const formattedRecipes = recipes.map((recipe) => ({
      id: recipe.id,
      title: recipe.title || 'Untitled Recipe',
      description: recipe.description,
      imageUrl: recipe.imageUrl,
      difficulty: recipe.difficulty || 'medium',
      cookingTime: recipe.cookingTime,
      prepTime: recipe.prepTime,
      servings: recipe.servings,
      likesCount: recipe._count.likes,
      commentsCount: recipe._count.comments,
      createdAt: recipe.createdAt,
    }));

    return NextResponse.json({ recipes: formattedRecipes, total });
  } catch (error) {
    logServerError('Error fetching user recipes:', error);
    return NextResponse.json({ error: 'Failed to fetch recipes' }, { status: 500 });
  }
}
