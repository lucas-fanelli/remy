import { NextRequest, NextResponse } from 'next/server';
import { container } from '@/lib/container/container';
import prisma from '@/lib/database/prisma';

// GET - Get user's shopping lists
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

    const shoppingLists = await prisma.shoppingList.findMany({
      where: { userId: payload.userId },
      include: {
        items: {
          orderBy: { addedAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ shoppingLists });
  } catch (error) {
    console.error('Error fetching shopping lists:', error);
    return NextResponse.json({ error: 'Failed to fetch shopping lists' }, { status: 500 });
  }
}

// POST - Create shopping list from recipe
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
    const { recipeId, recipeName } = body;

    if (!recipeId) {
      return NextResponse.json({ error: 'Recipe ID is required' }, { status: 400 });
    }

    // Get the recipe
    const recipe = await prisma.post.findUnique({
      where: { id: recipeId },
    });

    if (!recipe || !recipe.ingredients) {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
    }

    // Get user's pantry
    const pantry = await prisma.userPantry.findUnique({
      where: { userId: payload.userId },
      include: { items: true },
    });

    const recipeIngredients = recipe.ingredients as Array<{
      name: string;
      amount: number;
      unit: string;
    }>;

    // Normalize ingredient names for matching
    const normalizeIngredientName = (name: string): string => {
      return name.toLowerCase().trim()
        .replace(/s$/, '')
        .replace(/es$/, '')
        .replace(/[^a-z0-9]/g, '');
    };

    // Find missing ingredients
    const missingIngredients = recipeIngredients.filter((recipeIng) => {
      if (!pantry || !pantry.items.length) return true;

      const normalizedRecipe = normalizeIngredientName(recipeIng.name);

      return !pantry.items.some((pantryItem) => {
        const normalizedPantry = normalizeIngredientName(pantryItem.name);
        return normalizedPantry === normalizedRecipe ||
               normalizedPantry.includes(normalizedRecipe) ||
               normalizedRecipe.includes(normalizedPantry);
      });
    });

    if (missingIngredients.length === 0) {
      return NextResponse.json({
        message: 'You have all ingredients!',
        missingCount: 0,
      });
    }

    // Create shopping list
    const shoppingList = await prisma.shoppingList.create({
      data: {
        userId: payload.userId,
        name: `Shopping for: ${recipeName || recipe.title || 'Recipe'}`,
      },
    });

    // Add missing ingredients as shopping list items
    await prisma.shoppingListItem.createMany({
      data: missingIngredients.map((ing) => ({
        shoppingListId: shoppingList.id,
        name: ing.name,
        quantity: ing.amount,
        unit: ing.unit,
        recipeId: recipeId,
        checked: false,
      })),
    });

    // Fetch the complete shopping list with items
    const completeList = await prisma.shoppingList.findUnique({
      where: { id: shoppingList.id },
      include: { items: true },
    });

    return NextResponse.json({
      shoppingList: completeList,
      message: `Shopping list created with ${missingIngredients.length} items`,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating shopping list:', error);
    return NextResponse.json({ error: 'Failed to create shopping list' }, { status: 500 });
  }
}
