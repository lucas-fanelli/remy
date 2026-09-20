import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { UUID_REGEX } from '@/lib/constants';
import prisma from '@/lib/database/prisma';
import { logServerError } from '@/lib/utils/logger';

/**
 * POST /api/recipes/[id]/save — say whether YOU have this recipe saved.
 *
 * Declarative and idempotent, for the same reason as the like endpoint next door: the
 * request states the end state rather than asking for a flip, so retrying it is safe.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: recipeId } = await params;

    if (!UUID_REGEX.test(recipeId)) {
      return NextResponse.json(
        { error: 'Invalid ID format', code: 'request.invalidId' },
        { status: 400 }
      );
    }

    let user;
    try {
      user = await requireAuth(request);
    } catch {
      return NextResponse.json({ error: 'Unauthorized', code: 'unauthorized' }, { status: 401 });
    }

    // COMPATIBILITY SHIM — see the like route. Remove together with that one.
    let intent: boolean | undefined;
    try {
      const body = await request.json();
      if (typeof body?.saved === 'boolean') intent = body.saved;
    } catch {
      // No body, or not JSON: treat as a legacy flip.
    }

    const result = await prisma.$transaction(async (tx) => {
      const recipe = await tx.post.findUnique({ where: { id: recipeId }, select: { id: true } });
      if (!recipe) {
        throw new Error('RECIPE_NOT_FOUND');
      }

      const existingSave = await tx.savedRecipe.findUnique({
        where: { userId_postId: { userId: user.id, postId: recipeId } },
        select: { id: true },
      });

      const shouldBeSaved = intent ?? !existingSave;

      if (shouldBeSaved && !existingSave) {
        await tx.savedRecipe.create({ data: { userId: user.id, postId: recipeId } });
      } else if (!shouldBeSaved && existingSave) {
        await tx.savedRecipe.delete({ where: { id: existingSave.id } });
      }

      return { saved: shouldBeSaved };
    });

    return NextResponse.json({
      saved: result.saved,
      message: result.saved ? 'Recipe saved successfully' : 'Recipe removed from saved',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'RECIPE_NOT_FOUND') {
      return NextResponse.json(
        { error: 'Recipe not found', code: 'recipe.notFound' },
        { status: 404 }
      );
    }
    logServerError('Error setting save:', error);
    return NextResponse.json(
      { error: 'Failed to save recipe', code: 'recipe.saveFailed' },
      { status: 500 }
    );
  }
}
