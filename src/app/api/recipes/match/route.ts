import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { container } from '@/lib/container/container';
import prisma from '@/lib/database/prisma';

interface Ingredient {
  name: string;
  amount: number;
  unit: string;
}

// Normalize ingredient names for matching (case-insensitive, basic plural handling)
function normalizeIngredientName(name: string): string {
  let normalized = name.toLowerCase().trim();
  // Remove common plural suffixes (order matters: check longer suffixes first)
  if (normalized.endsWith('ies') && normalized.length > 4) {
    normalized = normalized.slice(0, -3) + 'y'; // berries -> berry
  } else if (normalized.endsWith('ves') && normalized.length > 4) {
    normalized = normalized.slice(0, -3) + 'f'; // halves -> half
  } else if (
    normalized.endsWith('ses') ||
    normalized.endsWith('xes') ||
    normalized.endsWith('zes') ||
    normalized.endsWith('ches') ||
    normalized.endsWith('shes')
  ) {
    normalized = normalized.slice(0, -2); // boxes -> box, dishes -> dish
  } else if (normalized.endsWith('s') && !normalized.endsWith('ss') && normalized.length > 3) {
    normalized = normalized.slice(0, -1); // tomatoes -> tomato, but not "stress" -> "stres"
  }
  // Replace non-alphanumeric except spaces with empty, then normalize whitespace
  return normalized
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Check if pantry item matches recipe ingredient
function ingredientMatches(
  pantryItem: { name: string },
  recipeIngredient: { name: string }
): boolean {
  const normalizedPantry = normalizeIngredientName(pantryItem.name);
  const normalizedRecipe = normalizeIngredientName(recipeIngredient.name);

  return (
    normalizedPantry === normalizedRecipe ||
    normalizedPantry.includes(normalizedRecipe) ||
    normalizedRecipe.includes(normalizedPantry)
  );
}

// GET - Match recipes with user's pantry
export async function GET(request: NextRequest) {
  try {
    // Get authorization token
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const tokenService = container.getTokenService();
    const payload = tokenService.verify(token);

    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get user's pantry
    const pantry = await prisma.userPantry.findUnique({
      where: { userId: payload.userId },
      include: { items: true },
    });

    if (!pantry || pantry.items.length === 0) {
      return NextResponse.json({
        readyToCook: [],
        almostThere: [],
        needMore: [],
        pantryItemsCount: 0,
      });
    }

    // Get recipes with ingredients (limited to prevent OOM, select only needed fields)
    const recipes = await prisma.post.findMany({
      where: {
        ingredients: { not: Prisma.DbNull },
      },
      take: 500,
      select: {
        id: true,
        title: true,
        description: true,
        imageUrl: true,
        difficulty: true,
        cookingTime: true,
        prepTime: true,
        servings: true,
        ingredients: true,
        _count: {
          select: {
            likes: true,
            comments: true,
          },
        },
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    // Match recipes with pantry
    const readyToCook: any[] = [];
    const almostThere: any[] = [];
    const needMore: any[] = [];

    for (const recipe of recipes) {
      if (!recipe.ingredients || !Array.isArray(recipe.ingredients)) continue;

      const recipeIngredients = recipe.ingredients as unknown as Ingredient[];
      const totalIngredients = recipeIngredients.length;

      if (totalIngredients === 0) continue;

      let matchedCount = 0;
      const missingIngredients: Ingredient[] = [];

      for (const recipeIngredient of recipeIngredients) {
        const matched = pantry.items.some((pantryItem) =>
          ingredientMatches(pantryItem, recipeIngredient)
        );

        if (matched) {
          matchedCount++;
        } else {
          missingIngredients.push(recipeIngredient);
        }
      }

      const matchPercentage = (matchedCount / totalIngredients) * 100;

      const recipeData = {
        id: recipe.id,
        title: recipe.title || 'Untitled Recipe',
        description: recipe.description,
        imageUrl: recipe.imageUrl,
        difficulty: recipe.difficulty,
        cookingTime: recipe.cookingTime,
        prepTime: recipe.prepTime,
        servings: recipe.servings,
        ingredients: recipeIngredients,
        matchPercentage: Math.round(matchPercentage),
        matchedIngredients: matchedCount,
        totalIngredients,
        missingIngredients,
        likesCount: recipe._count.likes,
        commentsCount: recipe._count.comments,
        user: recipe.user,
      };

      if (matchPercentage === 100) {
        readyToCook.push(recipeData);
      } else if (matchPercentage >= 70) {
        almostThere.push(recipeData);
      } else {
        needMore.push(recipeData);
      }
    }

    // Sort by match percentage
    readyToCook.sort((a, b) => b.matchPercentage - a.matchPercentage);
    almostThere.sort((a, b) => b.matchPercentage - a.matchPercentage);
    needMore.sort((a, b) => b.matchPercentage - a.matchPercentage);

    return NextResponse.json({
      readyToCook,
      almostThere: almostThere.slice(0, 10), // Limit to 10
      needMore: needMore.slice(0, 10), // Limit to 10
      pantryItemsCount: pantry.items.length,
    });
  } catch (error) {
    console.error('Error matching recipes:', error);
    return NextResponse.json({ error: 'Failed to match recipes' }, { status: 500 });
  }
}
