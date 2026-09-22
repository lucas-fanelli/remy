import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { UUID_REGEX } from '@/lib/constants';
import prisma from '@/lib/database/prisma';
import { canSeePost, deniedPostResponse } from '@/lib/privacy/visibility';
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
      // As in the like route: nothing is saved or unsaved on a recipe the reader may not
      // see. A save made while they could see it stays in the database, hidden from Saved,
      // and comes back if they are let in again.
      const access = await canSeePost(tx, recipeId, user.id);
      if (access.status !== 'ok') return { denied: access };

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

      return { denied: null, saved: shouldBeSaved };
    });

    if (result.denied) return deniedPostResponse(result.denied);

    return NextResponse.json({
      saved: result.saved,
      message: result.saved ? 'Recipe saved successfully' : 'Recipe removed from saved',
    });
  } catch (error) {
    logServerError('Error setting save:', error);
    return NextResponse.json(
      { error: 'Failed to save recipe', code: 'recipe.saveFailed' },
      { status: 500 }
    );
  }
}
