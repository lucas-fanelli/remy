import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { CreateRecipeDTO } from '@/domain/types/recipe';
import { MAX_SEARCH_QUERY_LENGTH } from '@/lib/constants';
import { container } from '@/lib/container/container';
import prisma from '@/lib/database/prisma';
import { extractBearerToken } from '@/lib/utils/auth';

/**
 * GET /api/recipes - Fetch recipes with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse query parameters
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20') || 20));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0') || 0);
    const difficulty = searchParams.get('difficulty');
    const maxTime = searchParams.get('maxTime');
    const minTime = searchParams.get('minTime');
    const userId = searchParams.get('userId');
    const query = searchParams.get('q');
    const sort = searchParams.get('sort') || 'newest';

    // Build Prisma where clause
    const where: Prisma.PostWhereInput = {};

    if (query && query.length > MAX_SEARCH_QUERY_LENGTH) {
      return NextResponse.json({ error: 'Search query too long' }, { status: 400 });
    }

    if (query) {
      where.OR = [
        { title: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
      ];
    }

    if (difficulty) {
      where.difficulty = difficulty;
    }

    // Time filtering - both maxTime and minTime can be applied together
    if (maxTime || minTime) {
      where.cookingTime = {};
      if (maxTime) {
        const parsed = parseInt(maxTime);
        if (!isNaN(parsed)) where.cookingTime.lte = parsed;
      }
      if (minTime) {
        const parsed = parseInt(minTime);
        if (!isNaN(parsed)) where.cookingTime.gte = parsed;
      }
    }

    if (userId) {
      where.userId = userId;
    }

    // Determine sort order based on sort parameter
    let orderBy: Prisma.PostOrderByWithRelationInput[] = [{ createdAt: 'desc' }, { id: 'asc' }]; // Default: Newest
    switch (sort) {
      case 'rating_desc':
        orderBy = [{ averageRating: 'desc' }, { createdAt: 'desc' }];
        break;
      case 'rating_asc':
        orderBy = [{ averageRating: 'asc' }, { createdAt: 'desc' }];
        break;
      case 'most_reviewed':
        orderBy = [{ reviewCount: 'desc' }, { createdAt: 'desc' }];
        break;
      case 'newest':
      default:
        orderBy = [{ createdAt: 'desc' }, { id: 'asc' }];
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
      author: recipe.user
        ? {
            username: recipe.user.username,
            fullName: recipe.user.fullName,
            avatar: recipe.user.avatar,
          }
        : undefined,
      averageRating: recipe.averageRating,
      totalRatings: recipe.reviewCount,
      likeCount: recipe._count.likes,
      commentCount: recipe._count.comments,
    }));

    const total = await prisma.post.count({ where });

    return NextResponse.json({
      recipes: recipesWithRatings,
      count: recipesWithRatings.length,
      total,
      hasMore: recipes.length === limit,
    });
  } catch (error) {
    console.error('Error fetching recipes:', error);
    return NextResponse.json({ error: 'Failed to fetch recipes' }, { status: 500 });
  }
}

/**
 * POST /api/recipes - Create a new recipe
 */
export async function POST(request: NextRequest) {
  try {
    const token = extractBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized - No token provided' }, { status: 401 });
    }

    const tokenService = container.getTokenService();

    // Verify token and get user ID
    const payload = tokenService.verify(token);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Unauthorized - Invalid token' }, { status: 401 });
    }

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (body.imageUrl) {
      try {
        const imgUrl = new URL(body.imageUrl);
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
        if (
          imgUrl.hostname !== 'res.cloudinary.com' ||
          !cloudName ||
          !imgUrl.pathname.startsWith(`/${cloudName}/`)
        ) {
          return NextResponse.json(
            { error: 'Image must be uploaded through the app' },
            { status: 400 }
          );
        }
      } catch {
        return NextResponse.json({ error: 'Invalid image URL' }, { status: 400 });
      }
    }

    const recipeData: CreateRecipeDTO = {
      ...body,
      userId: payload.userId, // Set userId from token
    };

    // Create recipe using service
    const recipeService = container.getRecipeService();
    const recipe = await recipeService.createRecipe(recipeData);

    return NextResponse.json({ recipe, message: 'Recipe created successfully' }, { status: 201 });
  } catch (error) {
    console.error('Error creating recipe:', error);

    if (error instanceof Error) {
      // Validation errors
      if (error.message.includes('validation failed')) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    return NextResponse.json({ error: 'Failed to create recipe' }, { status: 500 });
  }
}
