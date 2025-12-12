import { NextRequest, NextResponse } from 'next/server';
import { container } from '@/lib/container/container';
import { IRecipeService } from '@/domain/services/IRecipeService';
import { ITokenService } from '@/domain/services/ITokenService';
import { RecipeSearchOptions, CreateRecipeDTO } from '@/domain/types/recipe';
import prisma from '@/lib/database/prisma';

/**
 * GET /api/recipes - Fetch recipes with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse query parameters
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const difficulty = searchParams.get('difficulty');
    const maxTime = searchParams.get('maxTime');
    const minTime = searchParams.get('minTime');
    const userId = searchParams.get('userId');
    const query = searchParams.get('q');
    const sort = searchParams.get('sort') || 'newest';

    // Build Prisma where clause
    const where: any = {};

    if (query) {
      where.OR = [
        { title: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
      ];
    }

    if (difficulty) {
      where.difficulty = difficulty;
    }

    // Time filtering (uses cookingTime as primary, can add prepTime if needed)
    if (maxTime) {
      where.cookingTime = { lte: parseInt(maxTime) };
    } else if (minTime) {
      where.cookingTime = { gte: parseInt(minTime) };
    }

    if (userId) {
      where.userId = userId;
    }

    // Determine sort order based on sort parameter
    let orderBy: any = { createdAt: 'desc' }; // Default: Newest
    switch (sort) {
      case 'rating_desc':
        orderBy = { averageRating: 'desc' };
        break;
      case 'rating_asc':
        orderBy = { averageRating: 'asc' };
        break;
      case 'most_reviewed':
        orderBy = { reviewCount: 'desc' };
        break;
      case 'newest':
      default:
        orderBy = { createdAt: 'desc' };
        break;
    }

    // Fetch recipes with cached ratings from database
    const recipes = await prisma.post.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
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
      orderBy,
      take: limit,
      skip: offset,
    });

    // Transform to expected format with author and ratings
    const recipesWithRatings = recipes.map((recipe) => ({
      id: recipe.id,
      title: recipe.title,
      description: recipe.description,
      imageUrl: recipe.imageUrl,
      userId: recipe.userId,
      cookingTime: recipe.cookingTime || 0,
      prepTime: recipe.prepTime || 0,
      servings: recipe.servings || 1,
      difficulty: recipe.difficulty || 'easy',
      ingredients: recipe.ingredients || [],
      instructions: recipe.instructions || [],
      caption: recipe.caption,
      createdAt: recipe.createdAt,
      updatedAt: recipe.updatedAt,
      author: recipe.user ? {
        username: recipe.user.username,
        fullName: recipe.user.fullName,
        avatar: recipe.user.avatar,
      } : undefined,
      averageRating: recipe.averageRating,
      totalRatings: recipe.reviewCount,
      likeCount: recipe._count.likes,
      commentCount: recipe._count.comments,
    }));

    return NextResponse.json({
      recipes: recipesWithRatings,
      count: recipesWithRatings.length,
      hasMore: recipes.length === limit,
    });
  } catch (error) {
    console.error('Error fetching recipes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recipes' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/recipes - Create a new recipe
 */
export async function POST(request: NextRequest) {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized - No token provided' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const tokenService = container.getTokenService();

    // Verify token and get user ID
    const payload = await tokenService.verify(token);
    if (!payload || !payload.userId) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const recipeData: CreateRecipeDTO = {
      ...body,
      userId: payload.userId, // Set userId from token
    };

    // Create recipe using service
    const recipeService = container.getRecipeService();
    const recipe = await recipeService.createRecipe(recipeData);

    return NextResponse.json(
      { recipe, message: 'Recipe created successfully' },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating recipe:', error);

    if (error instanceof Error) {
      // Validation errors
      if (error.message.includes('validation failed')) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to create recipe' },
      { status: 500 }
    );
  }
}
