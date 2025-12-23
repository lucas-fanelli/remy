import { NextRequest, NextResponse } from 'next/server';
import { container } from '@/lib/container/container';
import { IUserService } from '@/domain/services/IUserService';
import prisma from '@/lib/database/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');

    if (!query || query.trim().length === 0) {
      return NextResponse.json({ error: 'Search query is required' }, { status: 400 });
    }

    const userService = container.get<IUserService>('IUserService');

    // Search users by username
    const users = await userService.searchUsers(query.trim(), 100);

    // Search recipes with engagement data
    const recipes = await prisma.post.findMany({
      where: {
        OR: [
          { title: { contains: query.trim(), mode: 'insensitive' } },
          { description: { contains: query.trim(), mode: 'insensitive' } },
        ],
      },
      take: 100,
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

    // Get ratings for each recipe
    const recipeIds = recipes.map((r) => r.id);
    const ratings = await prisma.rating.groupBy({
      by: ['postId'],
      where: { postId: { in: recipeIds } },
      _avg: { rating: true },
      _count: { rating: true },
    });

    // Create ratings map
    const ratingsMap = new Map(
      ratings.map((r) => [
        r.postId,
        {
          averageRating: r._avg.rating || 0,
          totalRatings: r._count.rating || 0,
        },
      ])
    );

    // Format recipes response
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
      averageRating: ratingsMap.get(recipe.id)?.averageRating || 0,
      totalRatings: ratingsMap.get(recipe.id)?.totalRatings || 0,
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
