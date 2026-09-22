import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { UUID_REGEX } from '@/lib/constants';
import { readRecipeIngredients } from '@/lib/cooking/applyPantryPlan';
import { planPantryDeduction } from '@/lib/cooking/pantryPlan';
import prisma from '@/lib/database/prisma';
import { canSeePost, deniedPostResponse } from '@/lib/privacy/visibility';
import { logServerError } from '@/lib/utils/logger';

/**
 * GET /api/recipes/[id]/cook-plan — what cooking this would take out of your pantry.
 *
 * Nothing is written. It exists so the page can show the deduction before asking you to
 * confirm it: until now the only way to find out was to let it happen, and the dialog
 * that asked "cook anyway?" could only name the ingredients you had too little of —
 * never the ones you had none of, which were skipped in silence.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    if (!UUID_REGEX.test(id)) {
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

    // Before the ingredients are read. The plan lists them, amounts and all, so answering it
    // for a private author's recipe would hand a stranger the recipe one line at a time.
    const access = await canSeePost(prisma, id, user.id);
    if (access.status !== 'ok') return deniedPostResponse(access);

    const [recipe, pantry] = await Promise.all([
      prisma.post.findUnique({ where: { id }, select: { ingredients: true } }),
      prisma.userPantry.findUnique({ where: { userId: user.id }, include: { items: true } }),
    ]);

    // The gate has just found it; this covers a delete landing between the two reads.
    if (!recipe) return deniedPostResponse({ status: 'notFound' });

    const ingredients = readRecipeIngredients(recipe.ingredients);

    // A recipe whose ingredient list cannot be read is not a recipe we can deduct for.
    // Saying so is the point — cooking it used to succeed while quietly touching nothing.
    if (ingredients === null) {
      return NextResponse.json({
        plan: { ingredients: [], canCookNow: true },
        deductionSkipped: true,
      });
    }

    const plan = planPantryDeduction(pantry?.items ?? [], ingredients);

    return NextResponse.json({ plan, deductionSkipped: false });
  } catch (error) {
    logServerError('Error planning pantry deduction:', error);
    return NextResponse.json(
      { error: 'Failed to plan pantry deduction', code: 'cooked.planFailed' },
      { status: 500 }
    );
  }
}
