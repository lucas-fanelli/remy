import { NextRequest, NextResponse } from 'next/server';
import { UUID_REGEX, MAX_NOTES_LENGTH } from '@/lib/constants';
import { container } from '@/lib/container/container';
import prisma from '@/lib/database/prisma';
import { ingredientMatches, unitsMatch, parseAmount } from '@/lib/utils/ingredients';

// GET - Get user's cooked recipes
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const tokenService = container.getTokenService();
    const payload = tokenService.verify(token);

    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20') || 20));
    const skip = (page - 1) * limit;

    const cookedRecipes = await prisma.cookedRecipe.findMany({
      where: { userId: payload.userId },
      take: limit,
      skip,
      include: {
        post: {
          select: {
            id: true,
            title: true,
            imageUrl: true,
            description: true,
            difficulty: true,
            cookingTime: true,
            prepTime: true,
            user: {
              select: {
                username: true,
                avatar: true,
              },
            },
          },
        },
      },
      orderBy: { cookedAt: 'desc' },
    });

    return NextResponse.json({ cookedRecipes });
  } catch (error) {
    console.error('Error fetching cooked recipes:', error);
    return NextResponse.json({ error: 'Failed to fetch cooked recipes' }, { status: 500 });
  }
}

// POST - Mark a recipe as cooked
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const tokenService = container.getTokenService();
    const payload = tokenService.verify(token);

    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const { postId, rating, notes } = body;

    if (!postId || typeof postId !== 'string' || !UUID_REGEX.test(postId)) {
      return NextResponse.json({ error: 'Invalid recipe ID' }, { status: 400 });
    }

    if (notes !== undefined && typeof notes === 'string' && notes.length > MAX_NOTES_LENGTH) {
      return NextResponse.json(
        { error: `Notes must be ${MAX_NOTES_LENGTH} characters or less` },
        { status: 400 }
      );
    }

    if (
      rating !== undefined &&
      (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5)
    ) {
      return NextResponse.json(
        { error: 'Rating must be an integer between 1 and 5' },
        { status: 400 }
      );
    }

    // Verify the recipe exists and get its ingredients
    const recipe = await prisma.post.findUnique({
      where: { id: postId },
    });

    if (!recipe) {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
    }

    // Remove recipe ingredients from pantry and create cooked recipe atomically
    const cookedRecipe = await prisma.$transaction(async (tx) => {
      // Read pantry inside transaction to avoid stale data
      const pantry = await tx.userPantry.findUnique({
        where: { userId: payload.userId },
        include: { items: true },
      });

      if (pantry && recipe.ingredients) {
        const recipeIngredients = recipe.ingredients as Array<{
          name: string;
          amount: string;
          unit: string;
        }>;

        const matchedPantryIds = new Set<string>();

        for (const ingredient of recipeIngredients) {
          // Find matching pantry item (skip already-matched items to prevent double deduction)
          const pantryItem = pantry.items.find(
            (item) => !matchedPantryIds.has(item.id) && ingredientMatches(item, ingredient)
          );
          if (pantryItem) matchedPantryIds.add(pantryItem.id);

          if (pantryItem) {
            // Parse amounts - supports fractions like "1/2", skips "to taste"
            const recipeAmount = parseAmount(ingredient.amount);
            if (isNaN(recipeAmount)) continue;

            const pantryQuantity = pantryItem.quantity;

            // Check if units match using alias normalization
            const unitsCompatible = unitsMatch(pantryItem.unit, ingredient.unit);

            if (unitsCompatible) {
              const newQuantity = pantryQuantity - recipeAmount;

              if (newQuantity <= 0) {
                await tx.pantryItem.delete({
                  where: { id: pantryItem.id },
                });
              } else {
                await tx.pantryItem.update({
                  where: { id: pantryItem.id },
                  data: { quantity: newQuantity },
                });
              }
            }
          }
        }
      }

      // Create cooked recipe entry
      return tx.cookedRecipe.create({
        data: {
          userId: payload.userId,
          postId,
          rating,
          notes,
        },
        include: {
          post: {
            select: {
              id: true,
              title: true,
              imageUrl: true,
              description: true,
              difficulty: true,
              cookingTime: true,
              prepTime: true,
              user: {
                select: {
                  username: true,
                  avatar: true,
                },
              },
            },
          },
        },
      });
    });

    return NextResponse.json(
      {
        cookedRecipe,
        message: 'Recipe marked as cooked and ingredients removed from pantry',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error marking recipe as cooked:', error);
    return NextResponse.json({ error: 'Failed to mark recipe as cooked' }, { status: 500 });
  }
}

// DELETE - Remove a cooked recipe entry
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const tokenService = container.getTokenService();
    const payload = tokenService.verify(token);

    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const cookedRecipeId = searchParams.get('id');

    if (!cookedRecipeId || !UUID_REGEX.test(cookedRecipeId)) {
      return NextResponse.json({ error: 'Valid cooked recipe ID is required' }, { status: 400 });
    }

    // Verify ownership before deleting
    const cookedRecipe = await prisma.cookedRecipe.findFirst({
      where: {
        id: cookedRecipeId,
        userId: payload.userId,
      },
    });

    if (!cookedRecipe) {
      return NextResponse.json({ error: 'Cooked recipe not found' }, { status: 404 });
    }

    await prisma.cookedRecipe.delete({
      where: { id: cookedRecipeId },
    });

    return NextResponse.json({ message: 'Cooked recipe removed' });
  } catch (error) {
    console.error('Error removing cooked recipe:', error);
    return NextResponse.json({ error: 'Failed to remove cooked recipe' }, { status: 500 });
  }
}
