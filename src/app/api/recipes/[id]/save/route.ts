import { NextRequest, NextResponse } from 'next/server';
import { UUID_REGEX } from '@/lib/constants';
import { container } from '@/lib/container/container';
import prisma from '@/lib/database/prisma';
import { extractBearerToken } from '@/lib/utils/auth';

// GET - Check if recipe is saved
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: recipeId } = await params;

    if (!UUID_REGEX.test(recipeId)) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }

    const token = extractBearerToken(request);
    if (!token) {
      return NextResponse.json({ saved: false });
    }

    const tokenService = container.getTokenService();
    const payload = tokenService.verify(token);

    if (!payload) {
      return NextResponse.json({ saved: false });
    }

    // Check if recipe exists
    const recipe = await prisma.post.findUnique({
      where: { id: recipeId },
    });

    if (!recipe) {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
    }

    // Check if user has saved this recipe
    const savedRecipe = await prisma.savedRecipe.findUnique({
      where: {
        userId_postId: {
          userId: payload.userId,
          postId: recipeId,
        },
      },
    });

    return NextResponse.json({ saved: !!savedRecipe });
  } catch (error) {
    console.error('Error checking save status:', error);
    return NextResponse.json({ saved: false });
  }
}

// POST - Toggle save status
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: recipeId } = await params;

    if (!UUID_REGEX.test(recipeId)) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }

    const token = extractBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tokenService = container.getTokenService();
    const payload = tokenService.verify(token);

    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Fully atomic save toggle — recipe check + toggle inside one transaction
    const result = await prisma.$transaction(async (tx) => {
      const recipe = await tx.post.findUnique({ where: { id: recipeId } });
      if (!recipe) {
        throw new Error('RECIPE_NOT_FOUND');
      }

      const existingSave = await tx.savedRecipe.findUnique({
        where: {
          userId_postId: {
            userId: payload.userId,
            postId: recipeId,
          },
        },
      });

      if (existingSave) {
        await tx.savedRecipe.delete({ where: { id: existingSave.id } });
        return { saved: false, message: 'Recipe removed from saved' };
      } else {
        await tx.savedRecipe.create({
          data: { userId: payload.userId, postId: recipeId },
        });
        return { saved: true, message: 'Recipe saved successfully' };
      }
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'RECIPE_NOT_FOUND') {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
    }
    console.error('Error toggling save:', error);
    return NextResponse.json({ error: 'Failed to save recipe' }, { status: 500 });
  }
}
