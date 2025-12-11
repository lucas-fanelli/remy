import { NextResponse } from 'next/server';
import prisma from '@/lib/database/prisma';

/**
 * GET /api/admin/recalc-ratings
 * Backfill all recipes with their calculated average ratings
 * DELETE THIS FILE AFTER USE
 */
export async function GET() {
    try {
        // Get all recipes
        const recipes = await prisma.post.findMany({
            select: { id: true },
        });

        let updated = 0;
        const errors: string[] = [];

        for (const recipe of recipes) {
            try {
                // Calculate rating aggregation for this recipe
                const ratingAggregation = await prisma.rating.aggregate({
                    where: { postId: recipe.id },
                    _avg: { rating: true },
                    _count: { rating: true },
                });

                // Update the recipe with cached rating data
                await prisma.post.update({
                    where: { id: recipe.id },
                    data: {
                        averageRating: Math.round((ratingAggregation._avg.rating || 0) * 10) / 10,
                        reviewCount: ratingAggregation._count.rating || 0,
                    },
                });

                updated++;
            } catch (err: any) {
                errors.push(`Recipe ${recipe.id}: ${err.message}`);
            }
        }

        return NextResponse.json({
            success: true,
            message: `Recalculated ratings for ${updated} recipes`,
            total: recipes.length,
            updated,
            errors: errors.length > 0 ? errors : undefined,
        });
    } catch (error: any) {
        console.error('Error recalculating ratings:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
