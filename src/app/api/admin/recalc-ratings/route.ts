import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, isAdminAuthError } from '@/lib/auth/requireAdmin';
import prisma from '@/lib/database/prisma';

/**
 * POST /api/admin/recalc-ratings
 * Backfill all recipes with their calculated average ratings
 * Requires admin authentication
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if (isAdminAuthError(authResult)) return authResult;

    // Aggregate all ratings in a single query
    const ratingsByPost = await prisma.rating.groupBy({
      by: ['postId'],
      _avg: { rating: true },
      _count: { rating: true },
    });

    // Build a map of postId -> rating data
    const ratingsMap = new Map(
      ratingsByPost.map((r) => [
        r.postId,
        {
          averageRating: Math.round((r._avg.rating || 0) * 10) / 10,
          reviewCount: r._count.rating || 0,
        },
      ])
    );

    // Get all recipe IDs
    const recipes = await prisma.post.findMany({
      select: { id: true },
    });

    // Batch update all recipes
    let updated = 0;
    const errors: string[] = [];

    for (const recipe of recipes) {
      try {
        const ratingData = ratingsMap.get(recipe.id) || { averageRating: 0, reviewCount: 0 };
        await prisma.post.update({
          where: { id: recipe.id },
          data: ratingData,
        });
        updated++;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`Recipe ${recipe.id}: ${message}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Recalculated ratings for ${updated} recipes`,
      total: recipes.length,
      updated,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: unknown) {
    console.error('Error recalculating ratings:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
