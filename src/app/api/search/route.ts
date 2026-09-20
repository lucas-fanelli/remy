import { NextRequest, NextResponse } from 'next/server';
import striptags from 'striptags';
import { IUserService } from '@/domain/services/IUserService';
import { MAX_SEARCH_QUERY_LENGTH } from '@/lib/constants';
import { container } from '@/lib/container/container';
import prisma from '@/lib/database/prisma';
import { logServerError } from '@/lib/utils/logger';
import { safeRating } from '@/lib/utils/recipe';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20') || 20));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0') || 0);

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Search query is required', code: 'search.queryRequired' },
        { status: 400 }
      );
    }

    if (query.length > MAX_SEARCH_QUERY_LENGTH) {
      return NextResponse.json(
        { error: 'Search query too long', code: 'search.queryTooLong' },
        { status: 400 }
      );
    }

    const userService = container.get<IUserService>('IUserService');

    // Search users by username - strip email from public results.
    // Defense-in-depth: UserRepository.search already excludes email at query level,
    // but we strip it here too in case the repository implementation changes.
    const users = (await userService.searchUsers(query.trim(), limit, offset)).map((u) => ({
      username: u.username,
      fullName: u.fullName,
      avatar: u.avatar,
      bio: u.bio,
    }));

    // Search recipes with engagement data
    // Prisma 'contains' mode auto-escapes SQL wildcards (%, _) — no manual escaping needed
    const recipes = await prisma.post.findMany({
      where: {
        OR: [
          { title: { contains: query.trim(), mode: 'insensitive' } },
          { description: { contains: query.trim(), mode: 'insensitive' } },
        ],
        user: { isPrivate: false },
      },
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            username: true,
            avatar: true,
          },
        },
        _count: {
          select: {
            likes: true,
            comments: true,
          },
        },
      },
    });

    // Format recipes response - use cached rating values from post record
    const formattedRecipes = recipes.map((recipe) => ({
      id: recipe.id,
      title: recipe.title ? striptags(recipe.title) : recipe.title,
      description: recipe.description ? striptags(recipe.description) : null,
      imageUrl: recipe.imageUrl,
      difficulty: recipe.difficulty || 'medium',
      prepTime: recipe.prepTime || 0,
      cookingTime: recipe.cookingTime || 0,
      servings: recipe.servings || 4,
      likeCount: recipe._count.likes,
      commentCount: recipe._count.comments,
      averageRating: safeRating(recipe.averageRating),
      totalRatings: recipe.reviewCount ?? 0,
      author: {
        username: recipe.user.username,
        avatar: recipe.user.avatar,
      },
    }));

    return NextResponse.json({
      users,
      recipes: formattedRecipes,
    });
  } catch (error) {
    logServerError('Search error:', error);
    return NextResponse.json(
      { error: 'Failed to perform search', code: 'search.failed' },
      { status: 500 }
    );
  }
}
