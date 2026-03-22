import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, isAdminAuthError } from '@/lib/auth/requireAdmin';
import { PG_ADVISORY_LOCK_RECALC_RATINGS } from '@/lib/constants';
import prisma from '@/lib/database/prisma';
import { logServerError } from '@/lib/utils/logger';

/**
 * POST /api/admin/recalc-ratings
 * Backfill all recipes with their calculated average ratings
 * Requires admin authentication
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if (isAdminAuthError(authResult)) return authResult;

    // Atomic bulk update within a transaction with advisory lock to prevent
    // concurrent executions from producing inconsistent intermediate states.
    const total = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SET LOCAL statement_timeout = '30s'`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${PG_ADVISORY_LOCK_RECALC_RATINGS}, 0)`;

        // Use r.avg_rating directly (NULL for unrated recipes) instead of
        // COALESCE(r.avg_rating, 0) so that unrated recipes store NULL.
        // reviewCount uses COALESCE since 0 is a meaningful count.
        await tx.$executeRaw`
        UPDATE "Post" p
        SET "averageRating" = r.avg_rating,
            "reviewCount" = COALESCE(r.cnt, 0)
        FROM (
          SELECT p2.id,
                 ROUND(AVG(rt."rating")::numeric, 1)::float as avg_rating,
                 COUNT(rt.id)::int as cnt
          FROM "Post" p2
          LEFT JOIN "Rating" rt ON rt."postId" = p2.id
          GROUP BY p2.id
        ) r
        WHERE p.id = r.id
      `;

        return tx.post.count();
      },
      { timeout: 35000 }
    );

    return NextResponse.json({
      success: true,
      message: `Recalculated ratings for all recipes`,
      total,
    });
  } catch (error: unknown) {
    logServerError('Error recalculating ratings:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
