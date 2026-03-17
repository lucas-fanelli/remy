import { NextRequest, NextResponse } from 'next/server';
import { container } from '@/lib/container/container';
import prisma from '@/lib/database/prisma';

// GET - Check if recipe is saved
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: recipeId } = await params;

    // Get authorization token
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ saved: false });
    }

    const token = authHeader.substring(7);
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

    // Get authorization token
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
      await prisma.savedRecipe.delete({
        where: { id: existingSave.id },
      });
      return NextResponse.json({ saved: false, message: 'Recipe removed from saved' });
    } else {
      try {
        await prisma.savedRecipe.create({
          data: { userId: payload.userId, postId: recipeId },
        });
        return NextResponse.json({ saved: true, message: 'Recipe saved successfully' });
      } catch (err: unknown) {
        // Handle race condition - if already saved by concurrent request, unsave instead
        if (err instanceof Error && err.message.includes('Unique constraint')) {
          await prisma.savedRecipe.deleteMany({
            where: { userId: payload.userId, postId: recipeId },
          });
          return NextResponse.json({ saved: false, message: 'Recipe removed from saved' });
        }
        throw err;
      }
    }
  } catch (error) {
    console.error('Error toggling save:', error);
    return NextResponse.json({ error: 'Failed to save recipe' }, { status: 500 });
  }
}
