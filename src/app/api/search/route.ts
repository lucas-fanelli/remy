import { NextRequest, NextResponse } from 'next/server';
import { IUserService } from '@/domain/services/IUserService';
import { container } from '@/lib/container/container';
import prisma from '@/lib/database/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20') || 20));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0') || 0);

    if (!query || query.trim().length === 0) {
      return NextResponse.json({ error: 'Search query is required' }, { status: 400 });
    }

    const userService = container.get<IUserService>('IUserService');

    // Search users by username - strip email from public results
    const users = (await userService.searchUsers(query.trim(), limit)).map(
      ({ email, ...rest }) => rest
    );

    // Search recipes with engagement data
    const recipes = await prisma.post.findMany({
      where: {
        OR: [
          { title: { contains: query.trim(), mode: 'insensitive' } },
          { description: { contains: query.trim(), mode: 'insensitive' } },
        ],
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
      title: recipe.title,
      description: recipe.description,
      imageUrl: recipe.imageUrl,
      difficulty: recipe.difficulty || 'medium',
      prepTime: recipe.prepTime || 0,
      cookingTime: recipe.cookingTime || 0,
      servings: recipe.servings || 4,
      likeCount: recipe._count.likes,
      commentCount: recipe._count.comments,
      averageRating: recipe.averageRating ?? 0,
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
    console.error('Search error:', error);
    return NextResponse.json({ error: 'Failed to perform search' }, { status: 500 });
  }
}
