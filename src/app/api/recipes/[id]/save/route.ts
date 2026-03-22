import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { UUID_REGEX } from '@/lib/constants';
import { container } from '@/lib/container/container';
import prisma from '@/lib/database/prisma';
import { extractAuthToken } from '@/lib/utils/auth';
import { logServerError } from '@/lib/utils/logger';

// GET - Check if recipe is saved
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: recipeId } = await params;

    if (!UUID_REGEX.test(recipeId)) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }

    const token = extractAuthToken(request);
    if (!token) {
      return NextResponse.json({ saved: false });
    }

    const tokenService = container.getTokenService();
    const payload = tokenService.verify(token);

    if (!payload) {
      return NextResponse.json({ saved: false });
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
    logServerError('Error checking save status:', error);
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

    let user;
    try {
      user = await requireAuth(request);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
            userId: user.id,
            postId: recipeId,
          },
        },
      });

      if (existingSave) {
        await tx.savedRecipe.delete({ where: { id: existingSave.id } });
        return { saved: false, message: 'Recipe removed from saved' };
      } else {
        await tx.savedRecipe.create({
          data: { userId: user.id, postId: recipeId },
        });
        return { saved: true, message: 'Recipe saved successfully' };
      }
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'RECIPE_NOT_FOUND') {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
    }
    logServerError('Error toggling save:', error);
    return NextResponse.json({ error: 'Failed to save recipe' }, { status: 500 });
  }
}
