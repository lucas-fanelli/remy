import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import striptags from 'striptags';
import { requireAuth } from '@/lib/api/auth';
import { MAX_ITEM_NAME_LENGTH, PG_ADVISORY_LOCK_MATCH } from '@/lib/constants';
import prisma from '@/lib/database/prisma';
import { ingredientMatches, normalizeIngredientName } from '@/lib/utils/ingredients';
import { logServerError } from '@/lib/utils/logger';

/** Escape special characters for SQL LIKE patterns */
function escapeLike(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

interface Ingredient {
  name: string;
  amount: number;
  unit: string;
}

interface MatchedRecipeData {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string;
  difficulty: string | null;
  cookingTime: number | null;
  prepTime: number | null;
  servings: number | null;
  matchPercentage: number;
  matchedIngredients: number;
  totalIngredients: number;
  missingIngredients: string[];
  likesCount: number;
  commentsCount: number;
  user: { id: string; username: string; avatar: string | null } | null;
}

// GET - Match recipes with user's pantry
// Performance note: This endpoint is authenticated (per-user) and the candidate set is capped
// at a configurable LIMIT (default 200, max 200) from the DB. The 30 req/15min rate limit
// (MATCH_RATE_LIMIT_MAX_REQUESTS in middleware) is the primary protection against abuse.
// A per-user advisory lock (PG_ADVISORY_LOCK_MATCH) serializes concurrent match queries
// from the same user to prevent redundant expensive DB work.
export async function GET(request: NextRequest) {
  try {
    let user;
    try {
      user = await requireAuth(request);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Configurable candidate limit (default 200, range 50-200)
    const limit = Math.min(
      200,
      Math.max(50, parseInt(request.nextUrl.searchParams.get('limit') || '200') || 200)
    );

    // Phase 1: Short transaction for advisory lock + DB queries only.
    // Releases the DB connection quickly so CPU-intensive matching doesn't hold the pool.
    const { pantry, allCandidates } = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SET LOCAL statement_timeout = '5s'`;
        await tx.$executeRaw`SET LOCAL lock_timeout = '2s'`;
        // Use pg_try_advisory_xact_lock to avoid holding a connection while waiting for the lock.
        // Returns false immediately if another request from this user is already running.
        const [{ locked }] = await tx.$queryRaw<[{ locked: boolean }]>`
        SELECT pg_try_advisory_xact_lock(${PG_ADVISORY_LOCK_MATCH}::int, hashtext(${user.id})) AS locked
      `;
        if (!locked) {
          throw new Error('MATCH_IN_PROGRESS');
        }

        const pantry = await tx.userPantry.findUnique({
          where: { userId: user.id },
          include: { items: { take: 100, orderBy: { addedAt: 'desc' } } },
        });

        if (!pantry || pantry.items.length === 0) {
          return { pantry: null, allCandidates: [] as { id: string; ingredients: unknown }[] };
        }

        const pantryNames = pantry.items.map((item) => normalizeIngredientName(item.name));

        // Filter and sanitize pantry names for use in LIKE patterns.
        // Prisma.join() in tagged templates creates parameterized placeholders ($1, $2, ...),
        // so SQL injection is not possible. escapeLike handles LIKE wildcards.
        // Filter to safe alphanumeric names to prevent ReDoS via crafted patterns
        const pantryPatterns = pantryNames
          .filter(
            (n) =>
              n.length >= 2 && n.length <= MAX_ITEM_NAME_LENGTH && /^[\p{L}\p{N}\s\-'.]+$/u.test(n)
          )
          .slice(0, 20);

        let allCandidates: { id: string; ingredients: unknown }[];

        if (pantryPatterns.length > 0) {
          // No ESCAPE clause below: PostgreSQL rejects it with LIKE ANY(...), and the
          // backslash emitted by escapeLike is already the default LIKE escape character.
          const likePatterns = pantryPatterns.map((name) => `%${escapeLike(name)}%`);
          allCandidates = await tx.$queryRaw<{ id: string; ingredients: unknown }[]>`
          SELECT p.id, p.ingredients
          FROM "posts" p
          JOIN "users" u ON u.id = p."userId"
          WHERE u."isPrivate" = false
            AND p.ingredients IS NOT NULL AND jsonb_typeof(p.ingredients) = 'array' AND jsonb_array_length(p.ingredients) <= 100
            AND EXISTS (
              SELECT 1 FROM jsonb_array_elements(p.ingredients) AS elem
              WHERE length(elem->>'name') <= 200
                AND lower(elem->>'name') LIKE ANY(ARRAY[${Prisma.join(likePatterns)}])
            )
          ORDER BY p."averageRating" DESC NULLS LAST, p."createdAt" DESC
          LIMIT ${limit}
        `;
        } else {
          allCandidates = await tx.post.findMany({
            where: { ingredients: { not: Prisma.DbNull }, user: { isPrivate: false } },
            take: limit,
            orderBy: { averageRating: 'desc' },
            select: { id: true, ingredients: true },
          });
        }

        // Filter out oversized ingredient arrays to prevent memory exhaustion
        return {
          pantry,
          allCandidates: allCandidates.filter(
            (c) => Array.isArray(c.ingredients) && (c.ingredients as unknown[]).length <= 100
          ),
        };
      },
      { timeout: 8000 }
    );

    // Early return if no pantry or no candidates
    if (!pantry || pantry.items.length === 0) {
      return NextResponse.json({
        readyToCook: [],
        almostThere: [],
        needMore: [],
        pantryItemsCount: 0,
      });
    }

    if (allCandidates.length === 0) {
      return NextResponse.json({
        readyToCook: [],
        almostThere: [],
        needMore: [],
        pantryItemsCount: pantry.items.length,
      });
    }

    // Phase 2: CPU-intensive matching outside the transaction (no DB connection held)
    const normalizeCache = new Map<string, string>();
    const memoNormalize = (name: string) => {
      if (!normalizeCache.has(name)) normalizeCache.set(name, normalizeIngredientName(name));
      return normalizeCache.get(name)!;
    };

    const normalizedPantryItems = pantry.items.map((item) => ({
      ...item,
      normalizedName: memoNormalize(item.name),
    }));

    type MatchResult = {
      id: string;
      matchPercentage: number;
      matchedCount: number;
      totalIngredients: number;
      missingIngredients: Ingredient[];
    };
    const matchResults: MatchResult[] = [];

    let comparisonCount = 0;
    const MAX_COMPARISONS = 20_000;
    const matchStartTime = Date.now();

    for (const candidate of allCandidates) {
      if (Date.now() - matchStartTime > 4000) break; // 4s wall-clock limit
      if (!candidate.ingredients || !Array.isArray(candidate.ingredients)) continue;
      const recipeIngredients = candidate.ingredients as unknown as Ingredient[];
      if (
        !recipeIngredients.every(
          (i) =>
            typeof i?.name === 'string' &&
            i.name.length > 0 &&
            i.name.length <= MAX_ITEM_NAME_LENGTH &&
            (typeof i?.amount === 'string' || typeof i?.amount === 'number') &&
            typeof i?.unit === 'string' &&
            i.unit.length < 50
        )
      )
        continue;
      if (recipeIngredients.length === 0) continue;

      let matchedCount = 0;
      const missingIngredients: Ingredient[] = [];

      for (const recipeIngredient of recipeIngredients) {
        comparisonCount++;
        if (comparisonCount >= MAX_COMPARISONS) break;
        if (
          normalizedPantryItems.some((pantryItem) =>
            ingredientMatches(pantryItem, recipeIngredient)
          )
        ) {
          matchedCount++;
        } else {
          missingIngredients.push(recipeIngredient);
        }
      }
      if (comparisonCount >= MAX_COMPARISONS) break;

      const matchPercentage = (matchedCount / recipeIngredients.length) * 100;
      if (matchPercentage >= 30) {
        matchResults.push({
          id: candidate.id,
          matchPercentage,
          matchedCount,
          totalIngredients: recipeIngredients.length,
          missingIngredients,
        });
      }
    }

    // Sort by match quality and cap before batch fetch to bound DB load
    matchResults.sort((a, b) => b.matchPercentage - a.matchPercentage);
    const cappedResults = matchResults.slice(0, 60);

    if (cappedResults.length === 0) {
      return NextResponse.json({
        readyToCook: [],
        almostThere: [],
        needMore: [],
        pantryItemsCount: pantry.items.length,
      });
    }

    // Phase 3: Fetch full recipe data with timeout protection
    const matchedIds = cappedResults.map((m) => m.id);
    const recipes = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SET LOCAL statement_timeout = '5s'`;
        return tx.post.findMany({
          where: { id: { in: matchedIds }, user: { isPrivate: false } },
          select: {
            id: true,
            title: true,
            description: true,
            imageUrl: true,
            difficulty: true,
            cookingTime: true,
            prepTime: true,
            servings: true,
            _count: { select: { likes: true, comments: true } },
            user: { select: { id: true, username: true, avatar: true } },
          },
        });
      },
      { timeout: 6000 }
    );

    // Build lookup from match results
    const matchLookup = new Map(cappedResults.map((m) => [m.id, m]));

    // Categorize matched recipes
    const readyToCook: MatchedRecipeData[] = [];
    const almostThere: MatchedRecipeData[] = [];
    const needMore: MatchedRecipeData[] = [];

    for (const recipe of recipes) {
      const match = matchLookup.get(recipe.id);
      if (!match) continue;

      const recipeData: MatchedRecipeData = {
        id: recipe.id,
        title: recipe.title || 'Untitled Recipe',
        description: recipe.description,
        imageUrl: recipe.imageUrl,
        difficulty: recipe.difficulty,
        cookingTime: recipe.cookingTime,
        prepTime: recipe.prepTime,
        servings: recipe.servings,
        matchPercentage: Math.round(match.matchPercentage),
        matchedIngredients: match.matchedCount,
        totalIngredients: match.totalIngredients,
        missingIngredients: match.missingIngredients.map((i) => striptags(i.name)),
        likesCount: recipe._count.likes,
        commentsCount: recipe._count.comments,
        user: recipe.user,
      };

      if (match.matchPercentage === 100) {
        readyToCook.push(recipeData);
      } else if (match.matchPercentage >= 70) {
        almostThere.push(recipeData);
      } else {
        needMore.push(recipeData);
      }
    }

    // Sort by match percentage, limit to top 20 per category
    readyToCook.sort((a, b) => b.matchPercentage - a.matchPercentage);
    almostThere.sort((a, b) => b.matchPercentage - a.matchPercentage);
    needMore.sort((a, b) => b.matchPercentage - a.matchPercentage);
    readyToCook.splice(20);
    almostThere.splice(20);
    needMore.splice(20);

    return NextResponse.json({
      readyToCook,
      almostThere,
      needMore,
      pantryItemsCount: pantry.items.length,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'MATCH_IN_PROGRESS') {
      return NextResponse.json(
        { error: 'A match request is already in progress. Please wait and try again.' },
        { status: 429 }
      );
    }
    logServerError('Error matching recipes:', error);
    return NextResponse.json({ error: 'Failed to match recipes' }, { status: 500 });
  }
}
