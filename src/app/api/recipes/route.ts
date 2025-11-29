import { NextRequest, NextResponse } from 'next/server';
import { container } from '@/lib/container/container';
import { IRecipeService } from '@/domain/services/IRecipeService';
import { ITokenService } from '@/domain/services/ITokenService';
import { RecipeSearchOptions, CreateRecipeDTO } from '@/domain/types/recipe';

/**
 * GET /api/recipes - Fetch recipes with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const recipeService = container.getRecipeService();

    // Parse query parameters
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const difficulty = searchParams.get('difficulty');
    const maxTime = searchParams.get('maxTime');
    const userId = searchParams.get('userId');
    const query = searchParams.get('q');

    // Build search options
    const searchOptions: RecipeSearchOptions = {
      limit,
      offset,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    };

    if (query) {
      searchOptions.query = query;
    }

    if (difficulty || maxTime || userId) {
      searchOptions.filters = {};

      if (difficulty) searchOptions.filters.difficulty = difficulty as any;
      if (maxTime) searchOptions.filters.maxCookingTime = parseInt(maxTime);
      if (userId) searchOptions.filters.userId = userId;
    }

    // Fetch recipes
    const recipes = await recipeService.searchRecipes(searchOptions);

    return NextResponse.json({
      recipes,
      count: recipes.length,
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
