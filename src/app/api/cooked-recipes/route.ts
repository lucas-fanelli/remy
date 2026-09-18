import { NextRequest, NextResponse } from 'next/server';
import striptags from 'striptags';
import { z, ZodError } from 'zod';
import { requireAuth } from '@/lib/api/auth';
import {
  UUID_REGEX,
  MAX_NOTES_LENGTH,
  MAX_DAILY_COOKS,
  PG_ADVISORY_LOCK_COOKED_RECIPE,
} from '@/lib/constants';
import prisma from '@/lib/database/prisma';
import { normalizeIngredientName, unitsMatch, parseAmount } from '@/lib/utils/ingredients';
import { logAuditEvent, logServerError } from '@/lib/utils/logger';
// striptags strips HTML tags but does NOT escape attribute-context characters (", ', &).
// This is acceptable because React JSX auto-escapes all interpolated values in text and
// attribute contexts. dangerouslySetInnerHTML must NEVER be used with user-provided
// ingredient data (names, amounts, units, notes).
import { requireJsonContentType } from '@/lib/utils/request';

const cookedRecipeSchema = z
  .object({
    postId: z.string().regex(UUID_REGEX, 'Invalid recipe ID'),
    rating: z.number().int().min(1).max(5).optional(),
    notes: z.string().max(MAX_NOTES_LENGTH).optional().nullable(),
    force: z.boolean().optional(),
  })
  .strict();

interface InsufficientIngredient {
  name: string;
  required: number;
  available: number;
  unit: string;
}
interface PantryItemLike {
  id: string;
  name: string;
  unit: string;
  quantity: number;
}
interface RecipeIngredient {
  name: string;
  amount: string;
  unit: string;
}

/**
 * Plan and apply pantry deductions for a cooked recipe inside a transaction.
 * Returns a list of insufficient ingredients (empty if all deductions succeeded).
 */
interface DeductedIngredient {
  name: string;
  amount: number;
  unit: string;
  pantryItemId: string;
}

interface DeductionResult {
  insufficientIngredients: InsufficientIngredient[];
  deductedIngredients: DeductedIngredient[];
}

async function deductPantryItems(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  pantryItems: PantryItemLike[],
  recipeIngredients: RecipeIngredient[],
  force: boolean
): Promise<DeductionResult> {
  const insufficientIngredients: InsufficientIngredient[] = [];
  const deductedIngredients: DeductedIngredient[] = [];
  const matchedPantryIds = new Set<string>();

  // Pass 1: Plan all deductions before applying any
  const deductions: {
    itemId: string;
    newQuantity: number;
    name: string;
    amount: number;
    unit: string;
  }[] = [];
  const deletions: { id: string; name: string; amount: number; unit: string }[] = [];

  for (const ingredient of recipeIngredients) {
    // Find matching pantry item using exact normalized name + unit match
    // (not fuzzy substring) to avoid deducting wrong items like "rice vinegar" for "rice"
    const pantryItem = pantryItems.find(
      (item) =>
        !matchedPantryIds.has(item.id) &&
        normalizeIngredientName(item.name) === normalizeIngredientName(ingredient.name) &&
        unitsMatch(item.unit, ingredient.unit)
    );
    if (pantryItem) {
      matchedPantryIds.add(pantryItem.id);

      // Parse amounts - supports fractions like "1/2", skips "to taste"
      const recipeAmount = parseAmount(ingredient.amount);
      if (isNaN(recipeAmount) || !isFinite(recipeAmount) || recipeAmount <= 0) continue;

      const pantryQuantity = pantryItem.quantity;

      if (pantryQuantity >= recipeAmount) {
        const newQuantity = pantryQuantity - recipeAmount;
        if (newQuantity <= 0) {
          deletions.push({
            id: pantryItem.id,
            name: ingredient.name,
            amount: recipeAmount,
            unit: ingredient.unit,
          });
        } else {
          deductions.push({
            itemId: pantryItem.id,
            newQuantity,
            name: ingredient.name,
            amount: recipeAmount,
            unit: ingredient.unit,
          });
        }
      } else {
        insufficientIngredients.push({
          name: striptags(ingredient.name),
          required: recipeAmount,
          available: pantryQuantity,
          unit: striptags(ingredient.unit),
        });
        // When force=true, deduct whatever is available (consume the pantry item entirely)
        if (force && pantryQuantity > 0) {
          deletions.push({
            id: pantryItem.id,
            name: ingredient.name,
            amount: pantryQuantity,
            unit: ingredient.unit,
          });
        }
      }
    }
  }

  // Block if ingredients are insufficient and force was not requested
  if (insufficientIngredients.length > 0 && !force) {
    throw Object.assign(new Error('INSUFFICIENT_INGREDIENTS'), { insufficientIngredients });
  }

  // Pass 2: Apply all deductions sequentially (we're inside a transaction)
  for (const d of deductions) {
    await tx.pantryItem.update({
      where: { id: d.itemId },
      data: { quantity: d.newQuantity },
    });
    deductedIngredients.push({
      name: striptags(d.name),
      amount: d.amount,
      unit: d.unit,
      pantryItemId: d.itemId,
    });
  }

  for (const d of deletions) {
    await tx.pantryItem.delete({ where: { id: d.id } });
    deductedIngredients.push({
      name: striptags(d.name),
      amount: d.amount,
      unit: d.unit,
      pantryItemId: d.id,
    });
  }

  return { insufficientIngredients, deductedIngredients };
}

// GET - Get user's cooked recipes
export async function GET(request: NextRequest) {
  try {
    let user;
    try {
      user = await requireAuth(request);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
    return NextResponse.json({ error: 'Failed to fetch cooked recipes' }, { status: 500 });
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let rawBody;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    let postId: string,
      rating: number | undefined,
      notes: string | null | undefined,
      force: boolean | undefined;
    try {
      const parsed = cookedRecipeSchema.parse(rawBody);
      postId = parsed.postId;
      rating = parsed.rating;
      notes = parsed.notes;
      force = parsed.force;
    } catch (err) {
      if (err instanceof ZodError) {
        const firstIssue = err.issues[0]?.message || 'Invalid request body';
        return NextResponse.json({ error: firstIssue }, { status: 400 });
      }
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    // Strip HTML from notes to prevent XSS
    const validatedNotes = typeof notes === 'string' ? striptags(notes.trim()) || null : notes;

    // All checks and mutations inside a single transaction for atomicity
    const { cookedRecipe, insufficientIngredients, deductedIngredients, deductionSkipped } =
      await prisma.$transaction(async (tx) => {
        let insufficientIngredients: InsufficientIngredient[] = [];
        let deductedIngredients: DeductedIngredient[] = [];
        let deductionSkipped = false;

        // Verify the recipe exists inside the transaction
        const recipe = await tx.post.findUnique({ where: { id: postId } });
        if (!recipe) {
          throw new Error('RECIPE_NOT_FOUND');
        }

        // Check for duplicate within a rolling 24-hour window (timezone-safe)
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const existingCooked = await tx.cookedRecipe.findFirst({
          where: { userId: user.id, postId, cookedAt: { gte: twentyFourHoursAgo } },
        });
        if (existingCooked) {
          throw new Error('ALREADY_COOKED');
        }

        // Enforce daily cook limit to prevent abuse
        const dailyCookCount = await tx.cookedRecipe.count({
          where: { userId: user.id, cookedAt: { gte: twentyFourHoursAgo } },
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

        if (pantry && recipe.ingredients && Array.isArray(recipe.ingredients)) {
          // Sanitize ingredient names from the DB to prevent stored XSS in deductedIngredients
          // Filter out non-object elements to handle corrupted JSON gracefully
          const recipeIngredients = (recipe.ingredients as unknown[])
            .filter(
              (i): i is Record<string, unknown> =>
                i != null && typeof i === 'object' && !Array.isArray(i)
            )
            .map((i) => ({
              name: striptags(String(i.name || '')),
              amount: String(i.amount || ''),
              unit: striptags(String(i.unit || '')),
            }));

          const ingredientsValid = recipeIngredients.every(
            (i) =>
              typeof i?.name === 'string' &&
              i.name.length > 0 &&
              i.name.length <= 200 &&
              (typeof i?.amount === 'string' || typeof i?.amount === 'number') &&
              typeof i?.unit === 'string' &&
              i.unit.length < 50
          );
          if (!ingredientsValid) {
            console.warn(
              `[COOKED-RECIPES] Skipping pantry deduction for recipe ${postId}: ingredient validation failed (oversized name or unit)`
            );
            deductionSkipped = true;
          } else {
            const result = await deductPantryItems(
              tx,
              pantry.items,
              recipeIngredients,
              force === true
            );
            insufficientIngredients = result.insufficientIngredients;
            deductedIngredients = result.deductedIngredients;
          }
        }

        // Create cooked recipe entry
        const cookedRecipe = await tx.cookedRecipe.create({
          data: {
            userId: user.id,
            postId,
            rating,
            notes: validatedNotes,
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

        // Persist rating to Rating table and recalculate Post averages
        if (rating !== undefined) {
          // Lock the Post row BEFORE the upsert to serialize the entire read-modify-write
          // cycle and prevent concurrent rating aggregation races.
          await tx.$executeRaw`SELECT id FROM "posts" WHERE id = ${postId} FOR UPDATE`;

          await tx.rating.upsert({
            where: {
              userId_postId: {
                userId: user.id,
                postId,
              },
            },
            create: {
              userId: user.id,
              postId,
              rating,
            },
            update: {
              rating,
            },
          });

          const ratingAggregation = await tx.rating.aggregate({
            where: { postId },
            _avg: { rating: true },
            _count: { rating: true },
          });

          await tx.post.update({
            where: { id: postId },
            data: {
              averageRating:
                ratingAggregation._avg.rating != null
                  ? Math.round(ratingAggregation._avg.rating * 10) / 10
                  : undefined,
              reviewCount: ratingAggregation._count.rating ?? 0,
            },
          });
        }

        return { cookedRecipe, insufficientIngredients, deductedIngredients, deductionSkipped };
      });

    return NextResponse.json(
      {
        cookedRecipe,
        deductedIngredients,
        insufficientIngredients,
        deductionSkipped,
        message:
          insufficientIngredients.length > 0
            ? 'Recipe marked as cooked. Some ingredients could not be fully deducted from pantry.'
            : 'Recipe marked as cooked successfully!',
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'RECIPE_NOT_FOUND') {
        return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
      }
      if (error.message === 'ALREADY_COOKED') {
        return NextResponse.json(
          { error: 'Recipe already marked as cooked in the last 24 hours' },
          { status: 409 }
        );
      }
      if (error.message === 'DAILY_LIMIT_REACHED') {
        return NextResponse.json(
          {
            error: `Daily cook limit reached (${MAX_DAILY_COOKS} per day). Please try again tomorrow.`,
          },
          { status: 429 }
        );
      }
      if (error.message === 'INSUFFICIENT_INGREDIENTS') {
        return NextResponse.json(
          {
            error: 'Some ingredients are insufficient. Send force: true to proceed anyway.',
            insufficientIngredients: (
              error as Error & {
                insufficientIngredients: Array<{
                  name: string;
                  required: number;
                  available: number;
                  unit: string;
                }>;
              }
            ).insufficientIngredients,
          },
          { status: 409 }
        );
      }
    }
    logServerError('Error marking recipe as cooked:', error);
    return NextResponse.json({ error: 'Failed to mark recipe as cooked' }, { status: 500 });
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const cookedRecipeId = searchParams.get('id');

    if (!cookedRecipeId || !UUID_REGEX.test(cookedRecipeId)) {
      return NextResponse.json({ error: 'Valid cooked recipe ID is required' }, { status: 400 });
    }

    logAuditEvent('COOKED_RECIPE_DELETE', { userId: user.id, cookedRecipeId });

    // Delete cooked recipe, its rating, and recalculate post averages in a transaction.
    // Uses exactly-once delete semantics: delete() throws P2025 if the record is already
    // gone, preventing double-delete races without a separate findFirst + delete.
    const deleted = await prisma.$transaction(async (tx) => {
      // 1. Acquire per-user advisory lock FIRST to serialize the entire read-check-restore-delete
      // sequence. Without this, two concurrent DELETEs can both pass findFirst before either commits.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${PG_ADVISORY_LOCK_COOKED_RECIPE}::int, hashtext(${user.id}))`;

      // 2. Find the cooked recipe (verify ownership and get postId + deducted ingredients)
      const cookedRecipe = await tx.cookedRecipe.findFirst({
        where: { id: cookedRecipeId, userId: user.id, deletedAt: null },
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
            `[COOKED-RECIPES] Skipping pantry restoration for ${cookedRecipeId}: invalid deductedIngredients shape`
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
        where: { id: cookedRecipeId },
        data: {
          deletedAt: now,
          ...(canRestore ? { restoredAt: now } : {}),
        },
      });

      // 4. Only delete the associated rating if user has no comment on this post.
      // If a comment exists, the rating was created via the comment flow and should be preserved.
      const userComment = await tx.comment.findFirst({
        where: { userId: user.id, postId: cookedRecipe.postId },
      });

      if (!userComment) {
        // Lock the post row to prevent concurrent rating aggregation races
        await tx.$executeRaw`SELECT id FROM "posts" WHERE id = ${cookedRecipe.postId} FOR UPDATE`;

        await tx.rating.deleteMany({
          where: {
            userId: user.id,
            postId: cookedRecipe.postId,
          },
        });

        // Recalculate and cache the recipe's average rating
        const ratingAggregation = await tx.rating.aggregate({
          where: { postId: cookedRecipe.postId },
          _avg: { rating: true },
          _count: { rating: true },
        });

        await tx.post.update({
          where: { id: cookedRecipe.postId },
          data: {
            averageRating:
              ratingAggregation._avg.rating != null
                ? Math.round(ratingAggregation._avg.rating * 10) / 10
                : undefined,
            reviewCount: ratingAggregation._count.rating ?? 0,
          },
        });
      }

      return { cookedRecipe, restorationSkipped };
    });

    if (!deleted) {
      return NextResponse.json({ error: 'Cooked recipe not found' }, { status: 404 });
    }

    const message = deleted.restorationSkipped
      ? 'Cooked recipe removed. Pantry restoration skipped (restoration window expired or already restored).'
      : 'Cooked recipe removed';
    return NextResponse.json({ message });
  } catch (error) {
    logServerError('Error removing cooked recipe:', error);
    return NextResponse.json({ error: 'Failed to remove cooked recipe' }, { status: 500 });
  }
}
