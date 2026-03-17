import { NextRequest, NextResponse } from 'next/server';
import { container } from '@/lib/container/container';
import prisma from '@/lib/database/prisma';
import { extractBearerToken } from '@/lib/utils/auth';

// GET - Check if recipe is saved
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: recipeId } = await params;

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

    const token = extractBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tokenService = container.getTokenService();
    const payload = tokenService.verify(token);

    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Check if recipe exists
    const recipe = await prisma.post.findUnique({
      where: { id: recipeId },
    });

    if (!recipe) {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
    }

    // Check if already saved
    const existingSave = await prisma.savedRecipe.findUnique({
      where: {
        userId_postId: {
          userId: payload.userId,
          postId: recipeId,
        },
      },
    });

    if (existingSave) {
      try {
        await prisma.savedRecipe.delete({
          where: { id: existingSave.id },
        });
      } catch (err: unknown) {
        if (!(err instanceof Error && err.message.includes('Record to delete does not exist'))) {
          throw err;
        }
      }
      return NextResponse.json({ saved: false, message: 'Recipe removed from saved' });
    } else {
      try {
        await prisma.savedRecipe.create({
          data: { userId: payload.userId, postId: recipeId },
        });
        return NextResponse.json({ saved: true, message: 'Recipe saved successfully' });
      } catch (err: unknown) {
        // Handle race condition - if already saved by concurrent request, treat as idempotent save
        if (err instanceof Error && err.message.includes('Unique constraint')) {
          return NextResponse.json({ saved: true, message: 'Recipe already saved' });
        }
        throw err;
      }
    }
  } catch (error) {
    console.error('Error toggling save:', error);
    return NextResponse.json({ error: 'Failed to save recipe' }, { status: 500 });
  }
}
