import { NextRequest, NextResponse } from 'next/server';
import striptags from 'striptags';
import { z, ZodError } from 'zod';
import { requireAuth } from '@/lib/api/auth';
import { UUID_REGEX, MAX_DAILY_COOKS, PG_ADVISORY_LOCK_COOKED_RECIPE } from '@/lib/constants';
import {
  applyPantryPlan,
  readRecipeIngredients,
  type DeductedIngredient,
} from '@/lib/cooking/applyPantryPlan';
import {
  planPantryDeduction,
  shortfalls,
  type IngredientPlan,
  type PantryPlan,
} from '@/lib/cooking/pantryPlan';
import prisma from '@/lib/database/prisma';
import { normalizeIngredientName } from '@/lib/utils/ingredients';
import { logAuditEvent, logServerError } from '@/lib/utils/logger';
// striptags strips HTML tags but does NOT escape attribute-context characters (", ', &).
// This is acceptable because React JSX auto-escapes all interpolated values in text and
// attribute contexts. dangerouslySetInnerHTML must NEVER be used with user-provided
// ingredient data (names, amounts, units, notes).
import { requireJsonContentType } from '@/lib/utils/request';

const cookedRecipeSchema = z
  .object({
    postId: z.string().regex(UUID_REGEX, 'Invalid recipe ID'),
    // `rating` and `notes` are gone: no caller ever sent them, the columns behind them
    // were never read, and a score now belongs to PUT /api/recipes/[id]/rating rather
    // than being a side effect of saying you cooked something.
    force: z.boolean().optional(),
  })
  .strict();

// GET - Get user's cooked recipes
export async function GET(request: NextRequest) {
  try {
    let user;
    try {
      user = await requireAuth(request);
    } catch {
      return NextResponse.json({ error: 'Unauthorized', code: 'unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20') || 20));
    const skip = (page - 1) * limit;

    const [cookedRecipes, total] = await Promise.all([
      prisma.cookedRecipe.findMany({
        where: { userId: user.id, deletedAt: null },
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
      }),
      prisma.cookedRecipe.count({ where: { userId: user.id, deletedAt: null } }),
    ]);

    return NextResponse.json({
      cookedRecipes,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    logServerError('Error fetching cooked recipes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cooked recipes', code: 'cooked.fetchFailed' },
      { status: 500 }
    );
  }
}

// POST - Mark a recipe as cooked
export async function POST(request: NextRequest) {
  try {
    const ctError = requireJsonContentType(request);
    if (ctError) return ctError;

    let user;
    try {
      user = await requireAuth(request);
    } catch {
      return NextResponse.json({ error: 'Unauthorized', code: 'unauthorized' }, { status: 401 });
    }

    let rawBody;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body', code: 'invalidRequest' },
        { status: 400 }
      );
    }

    let postId: string, force: boolean | undefined;
    try {
      const parsed = cookedRecipeSchema.parse(rawBody);
      postId = parsed.postId;
      force = parsed.force;
    } catch (err) {
      // No code on the zod branch: the message names the field that failed, and
      // 'invalidRequest' would replace it with one generic sentence.
      if (err instanceof ZodError) {
        const firstIssue = err.issues[0]?.message || 'Invalid request body';
        return NextResponse.json({ error: firstIssue }, { status: 400 });
      }
      return NextResponse.json(
        { error: 'Invalid request body', code: 'invalidRequest' },
        { status: 400 }
      );
    }

    // Strip HTML from notes to prevent XSS

    // All checks and mutations inside a single transaction for atomicity
    const { cookedRecipe, shortfall, deductedIngredients, deductionSkipped, timesCooked } =
      await prisma.$transaction(async (tx) => {
        let shortfall: IngredientPlan[] = [];
        let deductedIngredients: DeductedIngredient[] = [];
        let deductionSkipped = false;

        // Verify the recipe exists inside the transaction
        const recipe = await tx.post.findUnique({ where: { id: postId } });
        if (!recipe) {
          throw new Error('RECIPE_NOT_FOUND');
        }

        // Cooking the same thing twice is the normal case, not a mistake — the schema was
        // always keyed to allow it. A rolling 24-hour duplicate check used to reject the
        // second one, which is why the button answered "you already cooked this" to
        // somebody who had just cooked it again.
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        // Enforce daily cook limit to prevent abuse. Entries the user has deleted do not
        // count against it — they are gone from every other query, and burning quota for
        // a record nobody can see was a way to be locked out with no explanation.
        const dailyCookCount = await tx.cookedRecipe.count({
          where: { userId: user.id, cookedAt: { gte: twentyFourHoursAgo }, deletedAt: null },
        });
        if (dailyCookCount >= MAX_DAILY_COOKS) {
          throw new Error('DAILY_LIMIT_REACHED');
        }

        // User-level advisory lock to prevent concurrent deductions from producing negative quantities.
        // Unlike SELECT FOR UPDATE, this works even if the pantry row doesn't exist yet.
        // Two-key form uses a namespace to avoid collisions with advisory locks in other features.
        // hashtext returns 32-bit int — collision risk is acceptable at <1M users. For larger scale, split UUID into two int4 keys.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${PG_ADVISORY_LOCK_COOKED_RECIPE}::int, hashtext(${user.id}))`;

        // Read pantry inside transaction to avoid stale data
        const pantry = await tx.userPantry.findUnique({
          where: { userId: user.id },
          include: { items: true },
        });

        if (pantry) {
          const recipeIngredients = readRecipeIngredients(recipe.ingredients);

          if (recipeIngredients === null) {
            console.warn(
              `[COOKED-RECIPES] Skipping pantry deduction for recipe ${postId}: ingredient validation failed (oversized name or unit)`
            );
            deductionSkipped = true;
          } else {
            const plan = planPantryDeduction(pantry.items, recipeIngredients);
            shortfall = shortfalls(plan);

            // Everything the reader was shown has to still be true when they confirm. If
            // the pantry changed under them — another tab, another device — the plan is
            // stale and nothing is written.
            if (shortfall.length > 0 && force !== true) {
              throw Object.assign(new Error('INSUFFICIENT_INGREDIENTS'), { plan });
            }

            deductedIngredients = await applyPantryPlan(tx, plan);
          }
        }

        // Create cooked recipe entry
        const cookedRecipe = await tx.cookedRecipe.create({
          data: {
            userId: user.id,
            postId,
            deductedIngredients:
              deductedIngredients.length > 0
                ? JSON.parse(JSON.stringify(deductedIngredients))
                : undefined,
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

        const timesCooked = await tx.cookedRecipe.count({
          where: { userId: user.id, postId, deletedAt: null },
        });

        return { cookedRecipe, shortfall, deductedIngredients, deductionSkipped, timesCooked };
      });

    return NextResponse.json(
      {
        cookedRecipe,
        deductedIngredients,
        // What could not be taken out, so the page can say so rather than claim a clean
        // deduction. The client used to be sent this only on the refusal path.
        shortfall,
        deductionSkipped,
        // How many times this reader has now cooked it — the page shows a count.
        timesCooked,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'RECIPE_NOT_FOUND') {
        return NextResponse.json(
          { error: 'Recipe not found', code: 'recipe.notFound' },
          { status: 404 }
        );
      }
      if (error.message === 'DAILY_LIMIT_REACHED') {
        return NextResponse.json(
          {
            error: `Daily cook limit reached (${MAX_DAILY_COOKS} per day). Please try again tomorrow.`,
            code: 'cooked.dailyLimit',
          },
          { status: 429 }
        );
      }
      if (error.message === 'INSUFFICIENT_INGREDIENTS') {
        return NextResponse.json(
          {
            error: 'Some ingredients are insufficient. Send force: true to proceed anyway.',
            code: 'cooked.insufficientIngredients',
            plan: (error as Error & { plan: PantryPlan }).plan,
          },
          { status: 409 }
        );
      }
    }
    logServerError('Error marking recipe as cooked:', error);
    return NextResponse.json(
      { error: 'Failed to mark recipe as cooked', code: 'cooked.markFailed' },
      { status: 500 }
    );
  }
}

// DELETE - Remove a cooked recipe entry
// Note: Uses query param ?id= instead of a nested route (/cooked-recipes/[id])
// to keep the route structure flat. Changing this would break existing clients.
// CSRF protection: middleware requires X-Requested-With header on mutating requests.
export async function DELETE(request: NextRequest) {
  try {
    let user;
    try {
      user = await requireAuth(request);
    } catch {
      return NextResponse.json({ error: 'Unauthorized', code: 'unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const cookedRecipeId = searchParams.get('id');
    // `?postId=` undoes the most recent cook of that recipe. The page offering "undo last
    // cook" knows which recipe it is showing, not which of the reader's cook entries is
    // the newest — asking it to find out first would be a round trip to learn an id it
    // only wants to hand straight back.
    const postIdToUndo = searchParams.get('postId');

    const byEntryId = cookedRecipeId !== null;
    const target = byEntryId ? cookedRecipeId : postIdToUndo;

    if (!target || !UUID_REGEX.test(target)) {
      return NextResponse.json(
        { error: 'Valid cooked recipe ID is required', code: 'cooked.invalidId' },
        { status: 400 }
      );
    }

    logAuditEvent('COOKED_RECIPE_DELETE', { userId: user.id, cookedRecipeId: target });

    // Delete cooked recipe, its rating, and recalculate post averages in a transaction.
    // Uses exactly-once delete semantics: delete() throws P2025 if the record is already
    // gone, preventing double-delete races without a separate findFirst + delete.
    const deleted = await prisma.$transaction(async (tx) => {
      // 1. Acquire per-user advisory lock FIRST to serialize the entire read-check-restore-delete
      // sequence. Without this, two concurrent DELETEs can both pass findFirst before either commits.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${PG_ADVISORY_LOCK_COOKED_RECIPE}::int, hashtext(${user.id}))`;

      // 2. Find the cooked recipe (verify ownership and get postId + deducted ingredients)
      const cookedRecipe = await tx.cookedRecipe.findFirst({
        where: byEntryId
          ? { id: target, userId: user.id, deletedAt: null }
          : { postId: target, userId: user.id, deletedAt: null },
        orderBy: { cookedAt: 'desc' },
        select: {
          id: true,
          postId: true,
          deductedIngredients: true,
          cookedAt: true,
          restoredAt: true,
        },
      });

      if (!cookedRecipe) return null;

      // Restore pantry items from stored deductedIngredients before deleting.
      // Guards against double-restoration (restoredAt) and stale restores (1-hour window).
      // The advisory lock (acquired above) serializes all cooked recipe operations per-user.
      // Validate shape with Zod to reject tampered or corrupted JSON.
      const deductedItemSchema = z.object({
        name: z.string().min(1).max(200),
        amount: z.number().positive().max(10000),
        unit: z.string().max(50).default(''),
        pantryItemId: z.string().uuid().optional(),
      });
      const deductedArraySchema = z.array(deductedItemSchema).max(100);

      const ONE_HOUR_MS = 60 * 60 * 1000;
      const withinRestorationWindow =
        cookedRecipe.cookedAt &&
        Date.now() - new Date(cookedRecipe.cookedAt).getTime() < ONE_HOUR_MS;
      const canRestore =
        cookedRecipe.deductedIngredients && !cookedRecipe.restoredAt && withinRestorationWindow;

      let restorationSkipped = false;
      if (cookedRecipe.deductedIngredients && !canRestore) {
        restorationSkipped = true;
      }

      if (canRestore) {
        const parsed = deductedArraySchema.safeParse(cookedRecipe.deductedIngredients);
        if (!parsed.success) {
          console.warn(
            `[COOKED-RECIPES] Skipping pantry restoration for ${cookedRecipe.id}: invalid deductedIngredients shape`
          );
        }
        const validDeducted = parsed.success ? parsed.data : [];

        if (validDeducted.length > 0) {
          // Batch-fetch all pantry items for this user in one query to avoid N+1
          const pantry = await tx.userPantry.findUnique({ where: { userId: user.id } });
          const allPantryItems = pantry
            ? await tx.pantryItem.findMany({ where: { pantryId: pantry.id } })
            : [];
          const byId = new Map(allPantryItems.map((i) => [i.id, i]));
          const byNameUnit = new Map(
            allPantryItems.map((i) => [`${normalizeIngredientName(i.name)}|${i.unit}`, i])
          );

          for (const d of validDeducted) {
            const safeName = striptags(d.name).slice(0, 200);
            if (!safeName) continue;
            const unit = striptags(d.unit).slice(0, 50);

            // Look up by pantryItemId first, then fall back to name+unit
            const existingItem =
              (d.pantryItemId ? byId.get(d.pantryItemId) : undefined) ??
              byNameUnit.get(`${normalizeIngredientName(safeName)}|${unit}`);

            if (existingItem) {
              const restoredQuantity = Math.min(existingItem.quantity + d.amount, 10000);
              await tx.pantryItem.update({
                where: { id: existingItem.id },
                data: { quantity: restoredQuantity },
              });
              // Update in-memory map so subsequent iterations see the new quantity
              existingItem.quantity = restoredQuantity;
            } else if (pantry && byId.size < 500) {
              const newItem = await tx.pantryItem.create({
                data: { pantryId: pantry.id, name: safeName, quantity: d.amount, unit },
              });
              // Add to maps so subsequent iterations can find it
              byId.set(newItem.id, newItem);
              byNameUnit.set(`${normalizeIngredientName(safeName)}|${unit}`, newItem);
            }
          }
        }
      }

      // 3. Soft-delete the cooked recipe. restoredAt is set if pantry items were restored,
      // preventing double-restoration. deletedAt marks the record as deleted for query filtering.
      const now = new Date();
      await tx.cookedRecipe.update({
        where: { id: cookedRecipe.id },
        data: {
          deletedAt: now,
          ...(canRestore ? { restoredAt: now } : {}),
        },
      });

      // Undoing a cook leaves your score alone. It used to delete it unless you also
      // had a comment on the recipe — the mirror of the exception in the comment route,
      // and the same confusion: your score's lifetime belonged to whichever of the two
      // you happened to keep. It is its own thing now.

      return { cookedRecipe, restorationSkipped };
    });

    if (!deleted) {
      return NextResponse.json(
        { error: 'Cooked recipe not found', code: 'cooked.notFound' },
        { status: 404 }
      );
    }

    // A flag rather than an English sentence: the page says this in the reader's language,
    // and the two outcomes are genuinely different — one put the pantry back, one did not.
    return NextResponse.json({ restorationSkipped: deleted.restorationSkipped });
  } catch (error) {
    logServerError('Error removing cooked recipe:', error);
    return NextResponse.json(
      { error: 'Failed to remove cooked recipe', code: 'cooked.removeFailed' },
      { status: 500 }
    );
  }
}
