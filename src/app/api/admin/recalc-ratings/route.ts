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

    // Atomic bulk update within a transaction
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE "Post" p
        SET "averageRating" = COALESCE(r.avg_rating, 0),
            "reviewCount" = COALESCE(r.cnt, 0)
        FROM (
          SELECT "postId",
                 ROUND(AVG("rating")::numeric, 1)::float as avg_rating,
                 COUNT(*)::int as cnt
          FROM "Rating"
          GROUP BY "postId"
        ) r
        WHERE p.id = r."postId"
      `;

      await tx.$executeRaw`
        UPDATE "Post"
        SET "averageRating" = 0, "reviewCount" = 0
        WHERE id NOT IN (SELECT DISTINCT "postId" FROM "Rating")
      `;
    });

    const total = await prisma.post.count();

    return NextResponse.json({
      success: true,
      message: `Recalculated ratings for all recipes`,
      total,
    });
  } catch (error: unknown) {
    console.error('Error recalculating ratings:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
