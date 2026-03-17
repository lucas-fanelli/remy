import { NextRequest, NextResponse } from 'next/server';
import { IngredientMatchFilters } from '@/domain/types/pantry';
import { container } from '@/lib/container/container';

/**
 * POST /api/recipes/suggest - Get recipe suggestions based on available ingredients
 */
export async function POST(request: NextRequest) {
  try {
    // Authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized - No token provided' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const tokenService = container.getTokenService();
    const payload = tokenService.verify(token);

    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Unauthorized - Invalid token' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { ingredients, filters, usePantry } = body;

    let userIngredients: string[] = [];

    // Option 1: Use user's pantry
    if (usePantry) {
      const pantryService = container.getPantryService();
      const pantry = await pantryService.getUserPantry(payload.userId);

      if (!pantry || pantry.ingredients.length === 0) {
        return NextResponse.json(
          { error: 'Your pantry is empty. Please add ingredients first.' },
          { status: 400 }
        );
      }

      userIngredients = pantry.ingredients.map((ing) => ing.name);
    }
    // Option 2: Use provided ingredients
    else if (ingredients && Array.isArray(ingredients)) {
      userIngredients = ingredients;
    } else {
      return NextResponse.json(
        { error: 'Either provide ingredients or set usePantry=true' },
        { status: 400 }
      );
    }

    if (userIngredients.length === 0) {
      return NextResponse.json({ error: 'No ingredients provided' }, { status: 400 });
    }

    // Build filters
    const matchFilters: IngredientMatchFilters = {
      ...filters,
      minMatchPercentage: filters?.minMatchPercentage || 50, // Default 50% minimum match
    };

    // Find matching recipes
    const ingredientMatchService = container.getIngredientMatchService();
    const matches = await ingredientMatchService.findRecipesByIngredients(
      userIngredients,
      matchFilters
    );

    // Group matches by category
    const perfectMatches = matches.filter((m) => m.hasAllIngredients);
    const highMatches = matches.filter((m) => !m.hasAllIngredients && m.matchPercentage >= 80);
    const goodMatches = matches.filter((m) => m.matchPercentage >= 60 && m.matchPercentage < 80);

    return NextResponse.json({
      totalMatches: matches.length,
      userIngredients,
      ingredientCount: userIngredients.length,
      matches: {
        perfect: {
          count: perfectMatches.length,
          recipes: perfectMatches.slice(0, 10), // Return top 10
        },
        high: {
          count: highMatches.length,
          recipes: highMatches.slice(0, 10),
        },
        good: {
          count: goodMatches.length,
          recipes: goodMatches.slice(0, 10),
        },
      },
      allMatches: matches.slice(0, 30), // Return top 30 overall
    });
  } catch (error) {
    console.error('Error suggesting recipes:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to suggest recipes' },
      { status: 500 }
    );
  }
}
