import { NextRequest, NextResponse } from 'next/server';
import { container } from '@/lib/container/container';
import prisma from '@/lib/database/prisma';

// GET - Get user's cooked recipes
export async function GET(request: NextRequest) {
  try {
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

    const cookedRecipes = await prisma.cookedRecipe.findMany({
      where: { userId: payload.userId },
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

    const token = authHeader.replace('Bearer ', '');
    const tokenService = container.getTokenService();
    const payload = tokenService.verify(token);

    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const { postId, rating, notes } = body;

    if (!postId) {
      return NextResponse.json({ error: 'Recipe ID is required' }, { status: 400 });
    }

    // Verify the recipe exists and get its ingredients
    const recipe = await prisma.post.findUnique({
      where: { id: postId },
    });

    if (!recipe) {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
    }

    // Get user's pantry
    const pantry = await prisma.userPantry.findUnique({
      where: { userId: payload.userId },
      include: {
        items: true,
      },
    });

    // Remove recipe ingredients from pantry
    if (pantry && recipe.ingredients) {
      const recipeIngredients = recipe.ingredients as Array<{ name: string; amount: string; unit: string }>;

      for (const ingredient of recipeIngredients) {
        // Find matching pantry item (case-insensitive name match)
        const pantryItem = pantry.items.find(
          item => item.name.toLowerCase() === ingredient.name.toLowerCase()
        );

        if (pantryItem) {
          // Parse amounts
          const recipeAmount = parseFloat(ingredient.amount);
          const pantryQuantity = pantryItem.quantity;

          // Check if units match (basic comparison, case-insensitive)
          const unitsMatch = pantryItem.unit.toLowerCase() === ingredient.unit.toLowerCase();

          if (unitsMatch && !isNaN(recipeAmount)) {
            const newQuantity = pantryQuantity - recipeAmount;

            if (newQuantity <= 0) {
              // Delete item if quantity is depleted
              await prisma.pantryItem.delete({
                where: { id: pantryItem.id },
              });
            } else {
              // Update quantity
              await prisma.pantryItem.update({
                where: { id: pantryItem.id },
                data: { quantity: newQuantity },
              });
            }
          }
        }
      }
    }

    // Create cooked recipe entry
    const cookedRecipe = await prisma.cookedRecipe.create({
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

    return NextResponse.json({
      cookedRecipe,
      message: 'Recipe marked as cooked and ingredients removed from pantry',
    }, { status: 201 });
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

    const token = authHeader.replace('Bearer ', '');
    const tokenService = container.getTokenService();
    const payload = tokenService.verify(token);

    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const cookedRecipeId = searchParams.get('id');

    if (!cookedRecipeId) {
      return NextResponse.json({ error: 'Cooked recipe ID is required' }, { status: 400 });
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
