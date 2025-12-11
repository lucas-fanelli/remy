import { NextResponse } from 'next/server';
import prisma from '@/lib/database/prisma';

/**
 * GET /api/fix-db
 * Temporary API route to fix missing database columns
 * DELETE THIS FILE AFTER USE
 */
export async function GET() {
    try {
        // FORCE creation of the missing imageUrl column on comments table
        const result = await prisma.$executeRawUnsafe(`
      ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
    `);

        return NextResponse.json({
            success: true,
            message: "Database patched successfully! imageUrl column added to comments table.",
            result: result.toString()
        });
    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
